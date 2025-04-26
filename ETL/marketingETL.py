import findspark
findspark.init()

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, FloatType, BooleanType, DateType, TimestampType, ArrayType

# NLTK imports and Sentiment Analyzer removed

# Initialize Spark Session
spark = SparkSession.builder \
    .appName("Yelp Marketing Star Schema ETL") \
    .config("spark.driver.memory", "4g") \
    .config("spark.executor.memory", "4g") \
    .config("spark.sql.legacy.timeParserPolicy", "LEGACY") \
    .getOrCreate()

# --- Configuration ---
input_base_path = "Yelp-JSON/Yelp JSON/yelp_dataset/"
output_base_path = "StarSchemaMarketingAndCustomerExperience/"

business_path = f"{input_base_path}yelp_academic_dataset_business.json"
checkin_path = f"{input_base_path}yelp_academic_dataset_checkin.json"
review_path = f"{input_base_path}yelp_academic_dataset_review.json"
tip_path = f"{input_base_path}yelp_academic_dataset_tip.json"
user_path = f"{input_base_path}yelp_academic_dataset_user.json"

# --- Helper Functions ---
def save_dataframe(df, table_name):
    """Saves DataFrame to Parquet format in the specified output directory."""
    output_path = f"{output_base_path}{table_name}"
    print(f"Saving {table_name} to {output_path}...")
    df.write.mode("overwrite").parquet(output_path)
    print(f"{table_name} saved successfully.")

# --- Sentiment Analysis UDF removed ---

# --- Load DataFrames ---
print("Loading source data...")
business_df = spark.read.json(business_path)
checkin_df = spark.read.json(checkin_path)
review_df = spark.read.json(review_path).withColumn("review_date", F.to_timestamp("date", "yyyy-MM-dd HH:mm:ss"))
tip_df = spark.read.json(tip_path).withColumn("tip_date", F.to_timestamp("date", "yyyy-MM-dd HH:mm:ss"))
user_df = spark.read.json(user_path).withColumn("yelping_since_date", F.to_timestamp("yelping_since", "yyyy-MM-dd HH:mm:ss"))
print("Source data loaded.")

# --- Create DimBusiness ---
print("Creating DimBusiness...")
dim_business = business_df.select(
    "business_id",
    "name",
    F.split(F.col("categories"), ",\s*").alias("categories_array"), # Split categories string into array
    "city",
    "state",
    "postal_code",
    "latitude",
    "longitude",
    F.col("is_open").cast(BooleanType()).alias("is_open"),
    F.to_json("attributes").alias("attributes_json") # Keep attributes as JSON string for flexibility
).withColumnRenamed("categories_array", "categories") # Rename for clarity if needed later

save_dataframe(dim_business, "DimBusiness")

# --- Create DimUser ---
print("Creating DimUser...")
dim_user = user_df.select(
    "user_id",
    "name",
    F.col("yelping_since_date").cast(DateType()).alias("yelping_since"),
    "review_count",
    "average_stars",
    "fans",
    F.split(F.col("elite"), ",").alias("elite_years"), # Split elite string into array
    (
        F.coalesce(F.col("compliment_cool"), F.lit(0)) + 
        F.coalesce(F.col("compliment_cute"), F.lit(0)) + 
        F.coalesce(F.col("compliment_funny"), F.lit(0)) +
        F.coalesce(F.col("compliment_hot"), F.lit(0)) + 
        F.coalesce(F.col("compliment_list"), F.lit(0)) + 
        F.coalesce(F.col("compliment_more"), F.lit(0)) +
        F.coalesce(F.col("compliment_note"), F.lit(0)) + 
        F.coalesce(F.col("compliment_photos"), F.lit(0)) + 
        F.coalesce(F.col("compliment_plain"), F.lit(0)) +
        F.coalesce(F.col("compliment_profile"), F.lit(0)) + 
        F.coalesce(F.col("compliment_writer"), F.lit(0))
    ).alias("compliment_count")
)
save_dataframe(dim_user, "DimUser")

# --- Create DimReview ---
print("Creating DimReview...")
dim_review = review_df.select(
    "review_id",
    F.col("text").alias("review_text")
) # Removed .withColumn for sentiment_score

save_dataframe(dim_review, "DimReview")

# --- Create DimDate ---
print("Creating DimDate...")
# Extract dates from reviews, tips, and checkins
review_dates = review_df.select(F.col("review_date").alias("timestamp_col"))
tip_dates = tip_df.select(F.col("tip_date").alias("timestamp_col"))

# Checkin dates need special handling as 'date' is a string of comma-separated timestamps
checkin_dates_exploded = checkin_df.select(
    "business_id",
    F.explode(F.split(F.col("date"), ",\s*")).alias("date_str")
).select(F.to_timestamp("date_str", "yyyy-MM-dd HH:mm:ss").alias("timestamp_col"))

# Combine all dates and get distinct calendar dates
all_dates = review_dates.union(tip_dates).union(checkin_dates_exploded)
distinct_dates = all_dates.select(F.to_date("timestamp_col").alias("full_date")).distinct().na.drop()

# Generate date dimension attributes
dim_date = distinct_dates \
    .withColumn("date_id", F.date_format(F.col("full_date"), "yyyyMMdd").cast(IntegerType())) \
    .withColumn("day", F.dayofmonth(F.col("full_date"))) \
    .withColumn("month", F.month(F.col("full_date"))) \
    .withColumn("quarter", F.quarter(F.col("full_date"))) \
    .withColumn("year", F.year(F.col("full_date"))) \
    .withColumn("day_of_week", F.date_format(F.col("full_date"), "EEEE")) \
    .select("date_id", "full_date", "day", "month", "quarter", "year", "day_of_week") \
    .orderBy("date_id")

save_dataframe(dim_date, "DimDate")


# --- Pre-aggregate Tip Counts ---
print("Aggregating Tip Counts...")
tip_counts = tip_df.groupBy("user_id", "business_id").agg(
    F.count("*").alias("tip_count")
)

# --- Pre-aggregate Checkin Counts ---
# Note: The original logic for checkin_counts might be inefficient joining exploded dates back.
# A direct aggregation on checkin_df after splitting/exploding is better.
print("Aggregating Checkin Counts...")
checkin_counts_agg = checkin_df.withColumn(
    "checkin_dates", F.split(F.col("date"), ",\s*")
).select(
    "business_id", F.size("checkin_dates").alias("checkin_count")
)

# --- Create FactCustomerEngagement ---
print("Creating FactCustomerEngagement...")
# Base fact data from reviews
fact_base = review_df.select(
    "review_id",
    "user_id",
    "business_id",
    F.date_format(F.col("review_date"), "yyyyMMdd").cast(IntegerType()).alias("date_id"),
    F.col("stars").cast(IntegerType()), # Cast stars to INT as per schema
    F.col("useful").alias("useful_votes"),
    F.col("funny").alias("funny_votes"),
    F.col("cool").alias("cool_votes")
)

# Join with aggregated counts and dimensions (ensure dimension keys exist)
fact_customer_engagement = fact_base \
    .join(tip_counts, ["user_id", "business_id"], "left") \
    .join(checkin_counts_agg, ["business_id"], "left") \
    .join(dim_date.select("date_id"), ["date_id"], "inner") \
    .join(dim_user.select("user_id"), ["user_id"], "inner") \
    .join(dim_business.select("business_id"), ["business_id"], "inner") # Ensure business exists in DimBusiness

# Select final columns and handle nulls from left joins
fact_customer_engagement = fact_customer_engagement.select(
    "review_id",
    "user_id",
    "business_id",
    "date_id",
    "stars",
    "useful_votes",
    "funny_votes",
    "cool_votes",
    F.coalesce(F.col("tip_count"), F.lit(0)).alias("tip_count"),
    F.coalesce(F.col("checkin_count"), F.lit(0)).alias("checkin_count")
)

save_dataframe(fact_customer_engagement, "FactCustomerEngagement")


# --- Optional: Create BusinessCategoryBridge ---
print("Creating BusinessCategoryBridge...")
bridge_business_category = dim_business.select(
    "business_id",
    F.explode("categories").alias("category") # Explode the categories array
).filter(F.col("category") != "") # Filter out empty strings if any

save_dataframe(bridge_business_category, "BusinessCategoryBridge")


print("ETL process finished.")
spark.stop() 