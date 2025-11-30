import os

file_path = r'e:\Uolink\main\Uolink\Uolink\functions\csv_parser.js'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
inserted = False

correct_block = [
    "    const regexes = [\n",
    "      /\\bBS\\s+([IVX]+|\\d+)\\s+([A-Za-z][A-Za-z&\\.\\s]+?)(?=,|\\/|\\)|$)/g,\n",
    "      /\\bBS\\s*\\(\\s*([IVX]+|\\d+)\\s*\\)\\s+([A-Za-z][A-Za-z&\\.\\s]+?)(?=,|\\/|\\)|$)/g,\n",
    "      /\\bBS\\s+([A-Za-z][A-Za-z&\\.\\s]+?)\\s+([IVX]+|\\d+)\\b/g,\n",
    "      /\\bBS\\s+([A-Za-z][A-Za-z&\\.\\s]+?)\\s*\\(\\s*([IVX]+|\\d+)\\s*\\)\\b/g,\n",
    "      /\\bBS\\s+([A-Za-z][A-Za-z&\\.\\s]+?)\\s*[-\\/]\\s*([IVX]+|\\d+)\\b/g\n",
    "    ]\n"
]

for line in lines:
    if "const regexes = [" in line:
        skip = True
        if not inserted:
            new_lines.extend(correct_block)
            inserted = True
    
    if skip:
        if "]" in line and line.strip() == "]":
            skip = False
        continue
    
    new_lines.append(line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Fixed regex block with escaped slashes.")
