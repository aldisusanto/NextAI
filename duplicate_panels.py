import re

with open('crypto.html', 'r') as f:
    content = f.read()

# 1. Update Header text
content = content.replace(
    'Spotlight pada token Unibase ($UB) dan watchlist favorit Anda.',
    'Spotlight pada token TAC Protocol ($TAC) dan Humanity ($HUM) dan watchlist favorit Anda.'
)

# 2. Extract the Spotlight Card and Analysis Panel block
# They start at <!-- Unibase Spotlight Card --> and end before <!-- TAB 1: OVERVIEW -->
start_marker = '<!-- Unibase Spotlight Card -->'
end_marker = '</div> <!-- END OF TAB 2: ANALYSIS -->'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    block = content[start_idx:end_idx]
    
    # Process TAC
    tac_block = block.replace('unibase', 'tac').replace('Unibase', 'TAC Protocol').replace('UB', 'TAC')
    
    # Process Humanity
    humanity_block = block.replace('unibase', 'humanity').replace('Unibase', 'Humanity').replace('UB', 'HUM')
    
    # Replace the original block with both
    new_block = tac_block + '\n\n' + humanity_block
    content = content[:start_idx] + new_block + content[end_idx:]
    
    with open('crypto.html', 'w') as f:
        f.write(content)
    print("Successfully updated crypto.html")
else:
    print("Could not find block markers")
