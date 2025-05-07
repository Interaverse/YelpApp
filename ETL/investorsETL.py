import pandas as pd
import os
import json
from datetime import datetime

# --- Configuration ---
# Adjust these paths if your Yelp dataset and desired output are elsewhere
YELP_DATA_DIR = r"C:\\Projects\\Yelp App\\Yelp-JSON\\Yelp JSON\\yelp_dataset" # Use raw string for Windows paths
OUTPUT_SCHEMA_DIR = r"C:\\Projects\\Yelp App\\output_star_schema"

BUSINESS_JSON_PATH = os.path.join(YELP_DATA_DIR, 'yelp_academic_dataset_business.json')
REVIEW_JSON_PATH = os.path.join(YELP_DATA_DIR, 'yelp_academic_dataset_review.json')
CHECKIN_JSON_PATH = os.path.join(YELP_DATA_DIR, 'yelp_academic_dataset_checkin.json')
# TIP_JSON_PATH = os.path.join(YELP_DATA_DIR, 'yelp_academic_dataset_tip.json') # Add if needed for facts

# --- Helper Functions ---

def load_json_lines(file_path):
    """Loads a JSON Lines file into a pandas DataFrame."""
    data = []
    print(f"Loading {os.path.basename(file_path)}...")
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    data.append(json.loads(line))
                except json.JSONDecodeError:
                    print(f"  Warning: Skipping invalid JSON line in {os.path.basename(file_path)}")
        print(f"Loaded {len(data)} records.")
        return pd.DataFrame(data)
    except FileNotFoundError:
        print(f"Error: File not found - {file_path}")
        return None
    except Exception as e:
        print(f"Error loading {file_path}: {e}")
        return None

def save_to_parquet(df, table_name):
    """Saves a DataFrame to a Parquet file in the output schema directory."""
    output_path = os.path.join(OUTPUT_SCHEMA_DIR, table_name)
    os.makedirs(output_path, exist_ok=True)
    file_path = os.path.join(output_path, f"{table_name}.parquet")
    try:
        print(f"Saving {table_name} to {file_path}...")
        df.to_parquet(file_path, index=False, engine='pyarrow')
        print(f"Successfully saved {table_name}.")
    except Exception as e:
        print(f"Error saving {table_name} to Parquet: {e}")

# --- Dimension Table Creation ---

def create_dim_location(df_business):
    """Creates the Location Dimension table."""
    print("Creating Dim_Location...")
    df_loc = df_business[['city', 'state', 'postal_code', 'latitude', 'longitude']].copy()
    df_loc = df_loc.drop_duplicates().reset_index(drop=True)
    df_loc['location_key'] = range(1, len(df_loc) + 1) # Surrogate key
    print(f"Dim_Location created with {len(df_loc)} unique locations.")
    return df_loc[['location_key', 'city', 'state', 'postal_code', 'latitude', 'longitude']]

def create_dim_category(df_business):
    """Creates the Category Dimension table."""
    print("Creating Dim_Category...")
    # Explode the categories string into individual categories
    df_business['categories'] = df_business['categories'].fillna('') # Handle missing categories
    all_categories = df_business['categories'].str.split(', ').explode()
    unique_categories = all_categories[all_categories != ''].drop_duplicates().reset_index(drop=True) # Remove empty strings
    df_cat = pd.DataFrame({'category_name': unique_categories})
    df_cat['category_key'] = range(1, len(df_cat) + 1) # Surrogate key
    print(f"Dim_Category created with {len(df_cat)} unique categories.")
    return df_cat[['category_key', 'category_name']]

def create_dim_date(df_review, df_checkin):
    """Creates the Date Dimension table from review and checkin dates."""
    print("Creating Dim_Date...")
    # Extract dates from reviews and checkins
    review_dates = pd.to_datetime(df_review['date']).dt.date
    # Checkin dates need parsing: "YYYY-MM-DD HH:MM:SS, YYYY-MM-DD HH:MM:SS, ..."
    checkin_dates_str = df_checkin['date'].str.split(', ').explode()
    checkin_dates = pd.to_datetime(checkin_dates_str, errors='coerce').dt.date # Coerce errors to NaT

    all_dates = pd.concat([review_dates, checkin_dates]).dropna().unique()
    df_date = pd.DataFrame({'full_date': sorted(all_dates)})
    df_date['date_key'] = df_date['full_date'].apply(lambda d: int(d.strftime('%Y%m%d'))) # Surrogate key (YYYYMMDD)

    # Add date attributes
    dt_series = pd.to_datetime(df_date['full_date'])
    df_date['year'] = dt_series.dt.year
    df_date['month'] = dt_series.dt.month
    df_date['day'] = dt_series.dt.day
    df_date['day_of_week'] = dt_series.dt.dayofweek # Monday=0, Sunday=6
    df_date['day_name'] = dt_series.dt.strftime('%A')
    df_date['month_name'] = dt_series.dt.strftime('%B')
    df_date['quarter'] = dt_series.dt.quarter
    df_date['is_weekend'] = df_date['day_of_week'].isin([5, 6])

    print(f"Dim_Date created with {len(df_date)} unique dates.")
    # Reorder columns for clarity
    return df_date[['date_key', 'full_date', 'year', 'month', 'day', 'day_of_week', 'day_name', 'month_name', 'quarter', 'is_weekend']]


def create_dim_business(df_business, df_location):
    """Creates the Business Dimension table, linking to Dim_Location."""
    print("Creating Dim_Business...")
    # Select relevant columns
    df_dim_bus = df_business[['business_id', 'name', 'address', 'city', 'state', 'postal_code', 'latitude', 'longitude', 'stars', 'review_count', 'is_open']].copy()

    # Merge with Dim_Location to get location_key
    df_dim_bus = pd.merge(
        df_dim_bus,
        df_location[['location_key', 'city', 'state', 'postal_code', 'latitude', 'longitude']],
        on=['city', 'state', 'postal_code', 'latitude', 'longitude'],
        how='left'
    )

    # Drop original location columns after merge
    df_dim_bus = df_dim_bus.drop(columns=['city', 'state', 'postal_code', 'latitude', 'longitude'])

    # Add a business surrogate key (optional, business_id is usually unique)
    df_dim_bus.rename(columns={'business_id': 'business_nk'}, inplace=True) # NK = Natural Key
    df_dim_bus['business_key'] = range(1, len(df_dim_bus) + 1) # Surrogate Key

    print(f"Dim_Business created with {len(df_dim_bus)} businesses.")
    # Reorder columns
    return df_dim_bus[['business_key', 'business_nk', 'name', 'address', 'location_key', 'stars', 'review_count', 'is_open']]


# --- Fact Table Creation ---

def create_fact_business_categories(df_business, df_category, df_dim_business):
    """Creates the bridge table linking businesses to categories."""
    print("Creating Fact_Business_Categories...")
    # Create a mapping from business_id (NK) to business_key (SK)
    business_key_map = df_dim_business[['business_nk', 'business_key']].set_index('business_nk')['business_key']

    # Create a mapping from category_name to category_key
    category_key_map = df_category.set_index('category_name')['category_key']

    # Explode categories again, similar to Dim_Category creation
    df_bus_cat = df_business[['business_id', 'categories']].copy()
    df_bus_cat['categories'] = df_bus_cat['categories'].fillna('').str.split(', ')
    df_exploded = df_bus_cat.explode('categories')
    df_exploded = df_exploded[df_exploded['categories'] != ''] # Remove empty categories

    # Map natural keys to surrogate keys
    df_exploded['business_key'] = df_exploded['business_id'].map(business_key_map)
    df_exploded['category_key'] = df_exploded['categories'].map(category_key_map)

    # Select and clean up the final fact table
    df_fact_cat = df_exploded[['business_key', 'category_key']].copy()
    df_fact_cat = df_fact_cat.dropna().drop_duplicates().astype(int) # Ensure keys are integers and unique

    print(f"Fact_Business_Categories created with {len(df_fact_cat)} links.")
    return df_fact_cat


def create_fact_business_performance(df_review, df_checkin, df_dim_business, df_dim_date):
    """Creates the Business Performance Fact table."""
    print("Creating Fact_Business_Performance...")

    # Create mapping dictionaries for keys
    business_key_map = df_dim_business.set_index('business_nk')['business_key']
    date_key_map = df_dim_date.set_index('full_date')['date_key']

    # --- Process Reviews ---
    print("  Processing reviews...")
    df_rev = df_review[['review_id', 'business_id', 'date', 'stars']].copy()
    df_rev['date'] = pd.to_datetime(df_rev['date']).dt.date
    df_rev['business_key'] = df_rev['business_id'].map(business_key_map)
    df_rev['date_key'] = df_rev['date'].map(date_key_map)
    df_rev = df_rev.dropna(subset=['business_key', 'date_key']) # Drop rows where mapping failed
    df_rev['date_key'] = df_rev['date_key'].astype(int)
    df_rev['business_key'] = df_rev['business_key'].astype(int)

    # Aggregate reviews by business and date
    review_agg = df_rev.groupby(['business_key', 'date_key']).agg(
        review_count=('review_id', 'count'),
        average_stars=('stars', 'mean')
    ).reset_index()
    print(f"  Aggregated {len(review_agg)} review records.")

    # --- Process Checkins ---
    print("  Processing checkins...")
    df_chk = df_checkin[['business_id', 'date']].copy()
    # Explode checkin dates
    df_chk['date'] = df_chk['date'].str.split(', ')
    df_chk_exploded = df_chk.explode('date')
    df_chk_exploded['date'] = pd.to_datetime(df_chk_exploded['date'], errors='coerce').dt.date
    df_chk_exploded = df_chk_exploded.dropna(subset=['date'])

    df_chk_exploded['business_key'] = df_chk_exploded['business_id'].map(business_key_map)
    df_chk_exploded['date_key'] = df_chk_exploded['date'].map(date_key_map)
    df_chk_exploded = df_chk_exploded.dropna(subset=['business_key', 'date_key']) # Drop rows where mapping failed
    df_chk_exploded['date_key'] = df_chk_exploded['date_key'].astype(int)
    df_chk_exploded['business_key'] = df_chk_exploded['business_key'].astype(int)


    # Aggregate checkins by business and date
    checkin_agg = df_chk_exploded.groupby(['business_key', 'date_key']).agg(
        checkin_count=('business_id', 'count') # Count occurrences for checkins
    ).reset_index()
    print(f"  Aggregated {len(checkin_agg)} checkin records.")

    # --- Combine Aggregations ---
    print("  Combining aggregates...")
    # Merge review and checkin data - outer join to keep all business/date combinations
    df_fact_perf = pd.merge(
        review_agg,
        checkin_agg,
        on=['business_key', 'date_key'],
        how='outer'
    )

    # Fill NaN values resulting from the outer join
    df_fact_perf['review_count'] = df_fact_perf['review_count'].fillna(0).astype(int)
    df_fact_perf['average_stars'] = df_fact_perf['average_stars'].fillna(0) # Or maybe leave as NaN? Decide based on use case.
    df_fact_perf['checkin_count'] = df_fact_perf['checkin_count'].fillna(0).astype(int)

    # Add a surrogate key for the fact table
    df_fact_perf.insert(0, 'performance_key', range(1, len(df_fact_perf) + 1))


    print(f"Fact_Business_Performance created with {len(df_fact_perf)} records.")
    # Reorder columns
    return df_fact_perf[['performance_key', 'business_key', 'date_key', 'review_count', 'average_stars', 'checkin_count']]


# --- Main ETL Execution ---

if __name__ == "__main__":
    print("Starting Yelp Star Schema ETL Process...")

    # Load source data
    df_business_raw = load_json_lines(BUSINESS_JSON_PATH)
    df_review_raw = load_json_lines(REVIEW_JSON_PATH)
    df_checkin_raw = load_json_lines(CHECKIN_JSON_PATH)
    # df_tip_raw = load_json_lines(TIP_JSON_PATH) # Load if needed

    if df_business_raw is None or df_review_raw is None or df_checkin_raw is None:
        print("ETL process cannot continue due to missing source data.")
    else:
        # Create Dimensions
        dim_location = create_dim_location(df_business_raw)
        dim_category = create_dim_category(df_business_raw)
        dim_date = create_dim_date(df_review_raw, df_checkin_raw)
        dim_business = create_dim_business(df_business_raw, dim_location)

        # Create Facts
        fact_business_categories = create_fact_business_categories(df_business_raw, dim_category, dim_business)
        fact_business_performance = create_fact_business_performance(df_review_raw, df_checkin_raw, dim_business, dim_date)

        # Save tables to Parquet
        save_to_parquet(dim_location, "Dim_Location")
        save_to_parquet(dim_category, "Dim_Category")
        save_to_parquet(dim_date, "Dim_Date")
        save_to_parquet(dim_business, "Dim_Business")
        save_to_parquet(fact_business_categories, "Fact_Business_Categories")
        save_to_parquet(fact_business_performance, "Fact_Business_Performance")

        print("\nYelp Star Schema ETL Process Completed Successfully.")
        print(f"Output files generated in: {OUTPUT_SCHEMA_DIR}") 