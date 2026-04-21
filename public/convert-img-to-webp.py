import os
from PIL import Image

BASE_DIR = r"D:\11-Mar-26-bak\pokemon essentials\pokedex_vite\public"

# Target sizes
# folder_name : (target_width, output_folder_name)
config = {
    "front": [
        (512, "front"),       # Large version for Detail page
        (128, "front_thumb")  # Tiny version for Grid page
    ],
    "side": [(256, "side")],
    "back": [(256, "back")],
    "side_battle": [(512, "side_battle")]
}

def optimize_pokedex():
    for source_folder, targets in config.items():
        input_path = os.path.join(BASE_DIR, source_folder)
        
        for size, output_subfolder in targets:
            output_path = os.path.join(BASE_DIR, f"{output_subfolder}_optimized")
            if not os.path.exists(output_path):
                os.makedirs(output_path)

            print(f"Creating {output_subfolder} ({size}px)...")

            for filename in os.listdir(input_path):
                if filename.lower().endswith((".png", ".jpg", ".jpeg")):
                    try:
                        with Image.open(os.path.join(input_path, filename)) as img:
                            img = img.convert("RGBA")
                            img = img.resize((size, size), Image.Resampling.LANCZOS)
                            
                            clean_name = os.path.splitext(filename)[0]
                            img.save(os.path.join(output_path, f"{clean_name}.webp"), "WEBP", quality=80)
                    except Exception as e:
                        print(f"Error on {filename}: {e}")

    print("\nDone! Swap the '_optimized' folders into your public directory.")

if __name__ == "__main__":
    optimize_pokedex()