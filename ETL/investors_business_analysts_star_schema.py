import json
import os
from collections import defaultdict

def get_python_type(value):
    """Gets the Python type name for a given value."""
    if value is None:
        return "null"
    elif isinstance(value, bool):
        return "boolean"
    elif isinstance(value, int):
        return "integer"
    elif isinstance(value, float):
        return "float"
    elif isinstance(value, str):
        return "string"
    elif isinstance(value, list):
        # Could potentially inspect list elements for more detail
        return "array"
    elif isinstance(value, dict):
        # Could potentially inspect dict elements for more detail
        return "object"
    else:
        return type(value).__name__

def generate_schema(dataset_dir, output_file="schema_description.txt", sample_size=100):
    """
    Reads sample lines from JSON files in a directory, infers the schema,
    and writes it to an output file. Assumes JSON Lines format (one JSON object per line).
    """
    schemas = {}
    print(f"Processing files in directory: {dataset_dir}")

    try:
        all_files = [f for f in os.listdir(dataset_dir) if f.endswith('.json')]
        print(f"Found JSON files: {all_files}")
    except FileNotFoundError:
        print(f"Error: Directory not found - {dataset_dir}")
        return
    except Exception as e:
        print(f"Error listing directory {dataset_dir}: {e}")
        return

    if not all_files:
        print(f"No JSON files found in {dataset_dir}")
        return

    for filename in all_files:
        filepath = os.path.join(dataset_dir, filename)
        print(f"Processing {filename}...")
        field_types = defaultdict(set)
        lines_processed = 0

        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                for i, line in enumerate(f):
                    if i >= sample_size:
                        break
                    try:
                        data = json.loads(line)
                        for key, value in data.items():
                            field_types[key].add(get_python_type(value))
                        lines_processed += 1
                    except json.JSONDecodeError:
                        print(f"  Warning: Skipping invalid JSON on line {i+1} in {filename}")
                    except Exception as e:
                        print(f"  Warning: Error processing line {i+1} in {filename}: {e}")

            if lines_processed > 0:
                schemas[filename] = {key: sorted(list(types)) for key, types in field_types.items()}
                print(f"  Processed {lines_processed} lines.")
            else:
                print(f"  Could not process any lines from {filename}.")


        except FileNotFoundError:
            print(f"  Error: File not found - {filepath}")
        except PermissionError:
             print(f"  Error: Permission denied reading file - {filepath}")
        except Exception as e:
            print(f"  Error reading or processing file {filepath}: {e}")

    # Write schema description to output file
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("Inferred Schema from Yelp Dataset JSON Files\n")
            f.write("============================================\n\n")
            f.write(f"Based on a sample of up to {sample_size} lines per file.\n")
            f.write("Assumes JSON Lines format (one JSON object per line).\n\n")

            if not schemas:
                 f.write("No schemas could be generated.\n")
                 print(f"Schema generation failed. Check logs above.")
                 return

            for filename, schema_info in schemas.items():
                f.write(f"Schema for {filename}:\n")
                if not schema_info:
                    f.write("  (Could not determine schema from sample)\n")
                else:
                    # Sort keys for consistent output
                    sorted_keys = sorted(schema_info.keys())
                    max_key_len = max(len(k) for k in sorted_keys) if sorted_keys else 0

                    for key in sorted_keys:
                        types_str = ", ".join(schema_info[key])
                        # Basic alignment for readability
                        f.write(f"  - {key.ljust(max_key_len)} : {types_str}\n")
                f.write("\n")
        print(f"\nSchema description successfully written to {output_file}")

    except Exception as e:
        print(f"Error writing schema description to {output_file}: {e}")


# --- Configuration ---
# IMPORTANT: Replace this with the actual path to your yelp_dataset directory
yelp_data_directory = r"C:\Projects\Yelp App\Yelp-JSON\Yelp JSON\yelp_dataset"
# Hardcode the output file path to ensure it's always created in the script's directory
output_schema_file = r"C:\Projects\Yelp App\Yelp-JSON\schema_description.txt"
lines_to_sample = 100 # Adjust if needed

# --- Run the schema generation ---
if __name__ == "__main__":
    if not os.path.isdir(yelp_data_directory):
         print(f"Error: The specified directory does not exist or is not a directory:")
         print(f"'{yelp_data_directory}'")
         print("Please update the 'yelp_data_directory' variable in the script.")
    else:
        generate_schema(yelp_data_directory, output_schema_file, lines_to_sample) 