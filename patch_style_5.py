with open('style.css', 'r') as f:
    lines = f.readlines()

with open('style.css', 'w') as f:
    for line in lines:
        if line.startswith('\\.recipe-aes-options'):
            f.write(line.replace('\\.', '.'))
        else:
            f.write(line)
