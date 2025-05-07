from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, FloatType, BooleanType, DateType, DecimalType

def create_spark_session():
    """Creates and returns a SparkSession."""
    return SparkSession.builder \
        .appName("YelpDataTransformation") \
        .config("spark.driver.memory", "4g") \
        .config("spark.executor.memory", "4g") \
        .getOrCreate()

def load_data(spark, file_path, schema=None):
    """Loads JSON data from the given path."""
    try:
        if schema:
            return spark.read.schema(schema).json(file_path)
        else:
            # Infer schema if not provided (can be slow for large files)
            # Consider defining explicit schemas for better performance and type safety
            return spark.read.json(file_path)
    except Exception as e:
        print(f"Error loading data from {file_path}: {e}")
        # Optionally, return an empty DataFrame or raise the exception
        # return spark.createDataFrame([], schema or StructType([])) # Example: Return empty DF
        raise # Re-raise the exception to stop execution

def main():
    """Main function to process Yelp data."""
    spark = create_spark_session()

    # --- Configuration ---
    # Adjust these paths based on your actual file locations
    input_base_path = "Yelp-JSON/Yelp JSON/yelp_dataset"
    output_base_path = "output_star_schema"

    business_path = f"{input_base_path}/yelp_academic_dataset_business.json"
    checkin_path = f"{input_base_path}/yelp_academic_dataset_checkin.json"
    review_path = f"{input_base_path}/yelp_academic_dataset_review.json"
    tip_path = f"{input_base_path}/yelp_academic_dataset_tip.json"
    # user_path = f"{input_base_path}/yelp_academic_dataset_user.json" # Not used in this schema

    # --- Load Data ---
    print("Loading data...")
    # Define schemas for better performance and type safety
    business_schema = StructType([
        StructField("business_id", StringType(), True),
        StructField("name", StringType(), True),
        StructField("address", StringType(), True),
        StructField("city", StringType(), True),
        StructField("state", StringType(), True),
        StructField("postal_code", StringType(), True),
        StructField("latitude", FloatType(), True),
        StructField("longitude", FloatType(), True),
        StructField("stars", FloatType(), True), # Used for DimBusiness reference if needed, but avg comes from reviews
        StructField("review_count", IntegerType(), True), # Used for DimBusiness reference if needed
        StructField("is_open", IntegerType(), True), # 0 or 1
        StructField("attributes", StringType(), True), # Loaded as string for simplicity
        StructField("categories", StringType(), True),
        StructField("hours", StringType(), True) # Loaded as string for simplicity
    ])

    checkin_schema = StructType([
        StructField("business_id", StringType(), True),
        StructField("date", StringType(), True) # String of comma-separated dates
    ])

    review_schema = StructType([
        StructField("review_id", StringType(), True),
        StructField("user_id", StringType(), True),
        StructField("business_id", StringType(), True),
        StructField("stars", FloatType(), True),
        StructField("useful", IntegerType(), True),
        StructField("funny", IntegerType(), True),
        StructField("cool", IntegerType(), True),
        StructField("text", StringType(), True),
        StructField("date", StringType(), True) # Timestamp string 'YYYY-MM-DD HH:MM:SS'
    ])

    tip_schema = StructType([
        StructField("user_id", StringType(), True),
        StructField("business_id", StringType(), True),
        StructField("text", StringType(), True),
        StructField("date", StringType(), True), # Timestamp string 'YYYY-MM-DD HH:MM:SS'
        StructField("compliment_count", IntegerType(), True)
    ])

    df_business = load_data(spark, business_path, business_schema)
    df_checkin = load_data(spark, checkin_path, checkin_schema)
    df_review = load_data(spark, review_path, review_schema)
    df_tip = load_data(spark, tip_path, tip_schema)

    # --- Create Dim_Date ---
    print("Creating Dim_Date...")
    # Extract distinct dates from reviews and tips
    review_dates = df_review.select(F.to_date(F.col("date")).alias("date"))
    tip_dates = df_tip.select(F.to_date(F.col("date")).alias("date"))

    # Checkin dates need parsing (string of comma-separated dates)
    # Explode the comma-separated string into multiple rows, then convert to date
    checkin_dates_exploded = df_checkin.withColumn("date_str", F.explode(F.split(F.col("date"), ", ")))
    checkin_dates = checkin_dates_exploded.select(F.to_date(F.trim(F.col("date_str"))).alias("date"))

    # Combine all dates and get distinct ones
    all_dates = review_dates.union(tip_dates).union(checkin_dates).distinct().na.drop()

    dim_date = all_dates.select(
        F.date_format(F.col("date"), "yyyyMMdd").alias("date_id"), # Format as YYYYMMDD string
        F.col("date").cast(DateType()).alias("date"),
        F.month(F.col("date")).alias("month"),
        F.year(F.col("date")).alias("year"),
        F.quarter(F.col("date")).alias("quarter"),
        (F.dayofweek(F.col("date")).isin([1, 7])).alias("is_weekend") # Sunday=1, Saturday=7
    )
    dim_date.show(5, truncate=False) # Show sample
    dim_date.write.mode("overwrite").parquet(f"{output_base_path}/Dim_Date")
    print(f"Dim_Date created with {dim_date.count()} records.")

    # --- Create Dim_Location ---
    print("Creating Dim_Location...")
    dim_location = df_business.select(
        F.col("business_id").alias("location_id"), # Using business_id as location_id assuming 1 loc/business
        F.col("business_id"),
        F.col("city"),
        F.col("state"),
        F.col("postal_code"),
        F.col("latitude"),
        F.col("longitude")
    ).distinct() # Ensure uniqueness if needed, although business_id should be unique
    dim_location.show(5, truncate=False)
    dim_location.write.mode("overwrite").parquet(f"{output_base_path}/Dim_Location")
    print(f"Dim_Location created with {dim_location.count()} records.")

    # --- Create Dim_Category and Bridge Table ---
    print("Creating Dim_Category and Bridge Table...")
    # Explode the categories string into one row per category per business
    business_categories_exploded = df_business.select(
        F.col("business_id"),
        F.explode(F.split(F.col("categories"), ",\s*")).alias("category_name")
    ).filter(F.col("category_name").isNotNull() & (F.col("category_name") != "") & (F.col("category_name") != "null"))

    # Create Dim_Category: Get distinct categories and assign an ID
    dim_category = business_categories_exploded.select("category_name") \
        .distinct() \
        .withColumn("category_id", F.monotonically_increasing_id()) \
        .select("category_id", "category_name") # Add parent_category logic if needed/possible

    dim_category.cache() # Cache for reuse in join
    dim_category.show(5, truncate=False)
    dim_category.write.mode("overwrite").parquet(f"{output_base_path}/Dim_Category")
    print(f"Dim_Category created with {dim_category.count()} records.")

    # Create the Bridge Table: Join exploded data with Dim_Category to link IDs
    fact_business_categories = business_categories_exploded.join(
        dim_category,
        business_categories_exploded["category_name"] == dim_category["category_name"],
        "inner"
    ).select(
        F.col("business_id"),
        F.col("category_id")
    ).distinct() # Ensure unique pairings

    fact_business_categories.show(5, truncate=False)
    fact_business_categories.write.mode("overwrite").parquet(f"{output_base_path}/Fact_Business_Categories")
    print(f"Fact_Business_Categories created with {fact_business_categories.count()} records.")
    dim_category.unpersist() # Unpersist after use

    # --- Create Dim_Business ---
    print("Creating Dim_Business with overall ratings and subcategory...")

    # Aggregate overall review stats per business
    business_review_overall_stats = df_review.groupBy("business_id") \
        .agg(
            F.avg("stars").alias("overall_avg_rating"),
            F.count("review_id").alias("overall_review_count")
        )

    # Prepare base business info with subcategory extraction
    business_base_info = df_business.select(
        F.col("business_id"),
        F.col("name"),
        # Split categories string by comma and optional whitespace
        F.split(F.col("categories"), ",\s*").alias("category_array"),
        (F.col("is_open") == 1).alias("is_open")
    ).withColumn(
        "subcategory",
        # Take second element as subcategory if it exists and is not null/empty
        F.when(
            (F.size(F.col("category_array")) > 1) &
            F.col("category_array")[1].isNotNull() &
            (F.col("category_array")[1] != "") &
            (F.col("category_array")[1] != "null"),
            F.col("category_array")[1]
          ).otherwise(None)
    ).drop("category_array") # Drop the intermediate array

    # Join overall stats back to the main business data
    dim_business = business_base_info.join(
        business_review_overall_stats,
        ["business_id"],
        "left" # Use left join in case some businesses have 0 reviews
    ).select(
        "business_id",
        "name",
        "subcategory", # Added subcategory
        "is_open",
        F.col("overall_avg_rating").cast(DecimalType(3, 1)), # Added overall rating
        F.coalesce(F.col("overall_review_count"), F.lit(0)).alias("overall_review_count") # Added overall count (fill nulls)
        # ownership_type is not directly available
        # Primary category is now handled via Fact_Business_Categories bridge table
    ).distinct()

    dim_business.show(5, truncate=False)
    dim_business.write.mode("overwrite").parquet(f"{output_base_path}/Dim_Business")
    print(f"Dim_Business created with {dim_business.count()} records.")


    # --- Create Fact_Business_Performance ---
    print("Creating Fact_Business_Performance (Monthly Granularity)...")

    # Add year and month columns to source dataframes
    df_review_ym = df_review.withColumn("date", F.to_date("date")) \
                            .withColumn("year", F.year(F.col("date"))) \
                            .withColumn("month", F.month(F.col("date")))

    df_checkin_ym = df_checkin.withColumn("date_str", F.explode(F.split(F.col("date"), ", "))) \
                             .withColumn("date", F.to_date(F.trim(F.col("date_str")))) \
                             .na.drop(subset=["date"]) \
                             .withColumn("year", F.year(F.col("date"))) \
                             .withColumn("month", F.month(F.col("date"))) \
                             .select("business_id", "year", "month", "date")

    df_tip_ym = df_tip.withColumn("date", F.to_date("date")) \
                       .withColumn("year", F.year(F.col("date"))) \
                       .withColumn("month", F.month(F.col("date")))

    # 1. Aggregate Review data Monthly
    review_agg_monthly = df_review_ym.groupBy("business_id", "year", "month") \
        .agg(
            F.count("review_id").alias("review_count_monthly")
            # No need for sum_stars_monthly as avg_rating is in Dim_Business now
        )

    # 2. Aggregate Checkin data Monthly
    checkin_agg_monthly = df_checkin_ym.groupBy("business_id", "year", "month") \
        .agg(F.count("*").alias("checkin_count_monthly"))

    # 3. Aggregate Tip data Monthly
    tip_agg_monthly = df_tip_ym.groupBy("business_id", "year", "month") \
        .agg(F.count("*").alias("tip_count_monthly"))

    # 4. Combine aggregates by business_id, year, and month
    # Need a base DataFrame with all relevant business_id and year/month combinations
    base_facts_monthly = review_agg_monthly.select("business_id", "year", "month") \
                           .union(checkin_agg_monthly.select("business_id", "year", "month")) \
                           .union(tip_agg_monthly.select("business_id", "year", "month")) \
                           .distinct()

    # Join aggregated data
    fact_table_monthly_joined = base_facts_monthly \
        .join(review_agg_monthly, ["business_id", "year", "month"], "left") \
        .join(checkin_agg_monthly, ["business_id", "year", "month"], "left") \
        .join(tip_agg_monthly, ["business_id", "year", "month"], "left") \
        .na.fill(0) # Fill null counts with 0 after joins

    # 5. Calculate Growth Rate
    business_window = Window.partitionBy("business_id").orderBy("year", "month")
    fact_table_with_lag = fact_table_monthly_joined.withColumn(
        "prev_month_review_count",
        F.lag("review_count_monthly", 1).over(business_window)
    )

    fact_table_with_growth = fact_table_with_lag.withColumn(
        "review_growth_rate",
        F.when(F.col("prev_month_review_count").isNull() | (F.col("prev_month_review_count") == 0), F.lit(None).cast(FloatType()))
        .otherwise(
            (F.col("review_count_monthly") - F.col("prev_month_review_count")) / F.col("prev_month_review_count")
        )
    ).drop("prev_month_review_count") # Drop intermediate column

    # 6. Calculate Monthly Engagement Score (photo_count is missing, assuming 0)
    photo_count_monthly = F.lit(0) # Placeholder for photo count
    fact_table_final_monthly = fact_table_with_growth.withColumn(
        "engagement_score",
        (F.col("review_count_monthly") * 1.0) +
        (F.col("tip_count_monthly") * 0.5) +
        (photo_count_monthly * 0.25) +
        (F.col("checkin_count_monthly") * 0.2)
    )

    # 7. Select and rename columns for the final fact table
    fact_business_performance = fact_table_final_monthly.select(
        F.col("business_id"),
        F.format_string("%04d%02d", F.col("year"), F.col("month")).alias("month_id"), # Create YYYYMM id
        F.col("review_count_monthly").alias("review_count"),
        F.col("checkin_count_monthly").alias("checkin_count"),
        F.col("tip_count_monthly").alias("tip_count"),
        photo_count_monthly.alias("photo_count"),
        F.col("engagement_score"),
        F.col("review_growth_rate").alias("growth_rate") # Renaming growth rate column
    )

    fact_business_performance.show(5, truncate=False)
    fact_business_performance.write.mode("overwrite").parquet(f"{output_base_path}/Fact_Business_Performance")
    print(f"Fact_Business_Performance created with {fact_business_performance.count()} records.")

    # --- Stop Spark Session ---
    print("Stopping Spark session.")
    spark.stop()

if __name__ == "__main__":
    main() 