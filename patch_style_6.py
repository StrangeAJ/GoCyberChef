import re
with open('style.css', 'r') as f:
    content = f.read()

# remove the first .recipe-aes-options flexbox definitions since we replaced it with grid
content = re.sub(r'\.recipe-aes-options \{\n    margin-top: 10px;\n    font-size: 0\.85em;\n    display: flex;\n    flex-wrap: wrap;\n    gap: 8px;\n    align-items: center;\n    background: #333;\n    padding: 8px;\n    border-radius: 4px;\n\}', '', content)

content = re.sub(r'\.recipe-aes-options label \{\n    color: #ccc;\n    white-space: nowrap;\n\}', '', content)

content = re.sub(r'\.recipe-aes-options input\[type="text"\], \.recipe-aes-options select \{\n    background-color: #444;\n    color: #f0f0f0;\n    border: 1px solid #555;\n    padding: 2px 4px;\n    border-radius: 3px;\n    outline: none;\n\}', '', content)

content = re.sub(r'\.recipe-aes-options input\[type="text"\] \{\n    width: 80px;\n\}', '', content)


with open('style.css', 'w') as f:
    f.write(content)
