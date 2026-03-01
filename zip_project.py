import os
import zipfile

def zip_project(output_filename):
    # Get the current working directory
    root_dir = os.getcwd()
    
    # Files and folders to exclude
    exclude_dirs = {'.git', '__pycache__', 'venv', 'env', 'node_modules', '.idea', '.vscode'}
    exclude_files = {'.env', '.DS_Store', output_filename, os.path.basename(__file__)}
    
    with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(root_dir):
            # Modify dirs in-place to skip excluded directories
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            
            for file in files:
                if file in exclude_files or file.endswith('.pyc'):
                    continue
                
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, root_dir)
                
                print(f"Adding: {arcname}")
                zipf.write(file_path, arcname)

if __name__ == "__main__":
    output_zip = "AI_INTERVIEW_ASSISTANT_Backup.zip"
    print(f"Creating backup: {output_zip}...")
    try:
        zip_project(output_zip)
        print(f"\n✅ Backup created successfully: {output_zip}")
        print("You can now upload this file manually to GitHub.")
    except Exception as e:
        print(f"\n❌ Error creating backup: {e}")