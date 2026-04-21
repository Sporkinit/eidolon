import csv, json, io, os

# This script generates pokedex.json and moves_db.json
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# 1. Define the Stat Modifiers for each Rank
# A is baseline (100 total), each step is roughly a 10% shift
RANK_MAP = {
    'SS': 1.2,  # +20%
    'S':  1.1,  # +10%
    'A':  1.0,  # Baseline
    'B':  0.9,  # -10%
    'C':  0.8,  # -20%
}

def read_csv(filename):
    path = os.path.join(SCRIPT_DIR, filename)
    if not os.path.exists(path):
        print(f"Warning: {filename} not found.")
        return []
    with open(path, 'rb') as f:
        # Using latin-1 to handle special characters in bios
        content = f.read().decode('latin-1')
    reader = csv.DictReader(io.StringIO(content))
    return list(reader)


# ---------- moves_db.json ----------
moves_rows = read_csv('moves.csv')
moves_db = {}

def parse_num(val, as_float=False):
    """Return a number if parseable, else None (for power/accuracy blanks)."""
    v = val.strip() if val else ''
    if v in ('', '-'):
        return None
    try:
        return float(v) if as_float else int(v)
    except ValueError:
        return None

for row in moves_rows:
    group = row['group'].strip()
    if group not in moves_db:
        moves_db[group] = []

    power    = parse_num(row.get('power', ''))
    accuracy = parse_num(row.get('accuracy', ''), as_float=True)
    pp       = parse_num(row.get('pp', '')) or 10
    priority = parse_num(row.get('priority', '0')) or 0
    eff_chance = parse_num(row.get('effectChance', '0')) or 0

    effect = row.get('effect', '').strip() or None
    effect_target = row.get('effectTarget', '').strip() or 'foe'

    moves_db[group].append({
        'id':           row['id'].strip(),
        'name':         row['name'].strip(),
        'type':         row['type'].strip(),
        'category':     row['category'].strip(),
        'pp':           pp,
        'power':        power,
        'accuracy':     accuracy,
        'priority':     priority,
        'effect':       effect,
        'effectChance': eff_chance,
        'effectTarget': effect_target,
        # Animation fields — kept as raw strings
        'sprite':       row.get('sprite', '').strip(),
        'target':       row.get('target', '').strip(),
        'count':        row.get('count', '1').strip(),
        'rotate':       row.get('rotate', 'N').strip(),
    })
    
with open(os.path.join(SCRIPT_DIR, 'moves_db.json'), 'w', encoding='utf-8') as f:
    json.dump(moves_db, f, indent=2)

# ---------- pokedex.json ----------
codex_rows = read_csv('codex.csv')

def parse_evolution(evo_str):
    if not evo_str or not evo_str.strip(): return []
    chains = []
    for branch in evo_str.split(','):
        path = [name.strip() for name in branch.split(';') if name.strip()]
        if path: chains.append(path)
    return chains

def parse_ordered_moves(row):
    """
    Ensures moves are ordered by Types (in field order) then Tags (in field order).
    This pushes 'Flex' or species-specific moves to the bottom.
    """
    # 1. Get elements in order: Types first, then Tags
    types = [t.strip().lower() for t in row.get('types', '').split(';') if t.strip()]
    tags = [t.strip().lower() for t in row.get('tags', '').split(';') if t.strip()]
    ordered_elements = types + tags
    
    # 2. Get the actual move groups assigned in the moves column
    raw_moves = [m.strip() for m in row.get('moves', '').split(';') if m.strip()]
    
    final_moves = []
    # 3. For every element (e.g., 'water'), find its corresponding move (e.g., 'WATER-C')
    for element in ordered_elements:
        prefix = element.upper()
        for m in raw_moves:
            if m.startswith(prefix):
                final_moves.append(m)
                break
                
    return final_moves

pokedex = []
for row in codex_rows:
    # Get the rank and determine the multiplier
    rank_val = row.get('rank', 'A').strip().upper()
    multiplier = RANK_MAP.get(rank_val, 1.0)

    def stat(key):
        v = row.get(key, '').strip()
        try:
            # 1. Get base value from CSV
            base_value = float(v)
            # 2. Apply the Rank multiplier and round to whole number
            return int(round(base_value * multiplier))
        except (ValueError, TypeError):
            return 0 

    pokedex.append({
        'id':         row['id'].strip(),
        'name':       row['name'].strip(),
        'rank':       rank_val,
        'types':      [t.strip() for t in row.get('types', '').split(';') if t.strip()],
        'tags':       [t.strip() for t in row.get('tags', '').split(';') if t.strip()],
        'evolution':  parse_evolution(row.get('evolution', '')),
        'scale':      row.get('scale', '1.0').strip(),
        'bio':        row.get('bio', '').strip(),
        'stats': {
            'hp':      stat('hp'),
            'atk':     stat('atk'),
            'def':     stat('def'),
            'special': stat('s.atk'), # Mapped for React UI
            'spd':     stat('spd'),
        },
        'moves':      parse_ordered_moves(row),
    })

# Sort by numeric id to ensure the list is in order
pokedex.sort(key=lambda c: int(c['id']))

with open(os.path.join(SCRIPT_DIR, 'pokedex.json'), 'w', encoding='utf-8') as f:
    json.dump(pokedex, f, indent=2)

print(f"Success! Generated pokedex.json ({len(pokedex)} entries) and moves_db.json.")