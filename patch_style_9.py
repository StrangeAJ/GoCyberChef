with open('style.css', 'r') as f:
    content = f.read()

content = content.replace('.recipe-aes-options {\n    display: flex;\n    flex-wrap: wrap;\n    gap: 4px 8px;\n    align-items: center;\n    margin-top: 10px;\n    font-size: 0.85em;\n    background: #333;\n    padding: 8px;\n    border-radius: 4px;\n    justify-content: flex-end;\n}',
""".recipe-aes-options {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    align-items: center;
    margin-top: 10px;
    font-size: 0.85em;
    background: #333;
    padding: 8px;
    border-radius: 4px;
}""")

with open('style.css', 'w') as f:
    f.write(content)
