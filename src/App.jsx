import React, { useEffect, useState } from 'react';
import styles from './App.module.css';
import './glow.css';

function Badge({ text }) {
  const colors = {
    Normal: '#a97442',
    Neutral: '#a97442',
    Electric: '#dbb30f',
    Ground: '#73554e',
    Fairy: '#df90e0',
    Dark: '#260345',
    Mythic: '#917d23',
    Fire: '#ff6b35',
    Water: '#1e90ff',
    Grass: '#2ecc71',
    Ice: '#73d7f5',
    Mech: '#b0b0b0',
  };

  const bgColor = colors[text] || '#444';

  return (
    <span
      className={styles.badge}
      style={{ backgroundColor: bgColor }}
    >
      {text}
    </span>
  );
}

function Entry({ creature, anchorMap, evolvesToMap }) {
  const { name, type1, type2, type3, image, evolvesFrom, ...rest } = creature;
  const types = [type1, type2, type3].filter(Boolean);

  const abilities = creature.abilities
    ? creature.abilities.split(',').map((a) => a.trim())
    : [];

  const evolvesFromLinks = evolvesFrom
    ? evolvesFrom.split(',').map((evo, idx) => (
        <div key={evo.trim()}>
          {idx === 0 ? '' : 'or '}
          <span>→ <a href={`#${anchorMap[evo.trim()]}`}>{evo.trim()}</a></span>
        </div>
      ))
    : null;

  const evolvesToLinks = evolvesToMap[name]?.map((next, i) => (
    <div key={next} style={{ paddingLeft: '20px' }}>
      → <a href={`#${anchorMap[next]}`}>{next}</a>
    </div>
  ));

  return (
    <div className={`${styles.entry} ${styles.horizontalCard} glow`} id={anchorMap[name]}>
      <img src={image} alt={name} className={styles['entry-img']} />
      <div className={styles['entry-details']}>
        <h2>{`#${String(creature.id).padStart(3, '0')} ${name}`}</h2>
        <div>
          {types.map((t) => (
            <Badge key={t} text={t} />
          ))}
        </div>
        <div className={styles['evo-tree']}>
          <strong>Evolution chain:</strong>
          <div>
            {evolvesFromLinks ? (
              <div style={{ marginBottom: '4px' }}>{evolvesFromLinks}</div>
            ) : (
              <div style={{ color: '#ccc', marginBottom: '4px' }}>Start</div>
            )}
            <div style={{ fontWeight: 'bold' }}>{name}</div>
            {evolvesToLinks}
          </div>
        </div>
        {abilities.length > 0 && (
          <p>
            <strong>Abilities:</strong>{' '}
            {abilities.map((a) => (
              <Badge key={a} text={a} />
            ))}
          </p>
        )}
      </div>
    </div>
  );
}

function getTypeIcon(type) {
  const icons = {
    Normal: '🐾',
    Fire: '🔥',
    Water: '💧',
    Grass: '🌿',
    Electric: '⚡',
    Ground: '⛰️',
    Fairy: '✨',
    Dark: '🌑',
    Mythic: '🌟',
    Ice: '❄️',
    Mech: '⚙️',
  };
  return icons[type] || '📦';
}

function App() {
  const [creatures, setCreatures] = useState([]);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    fetch('pokedex.json')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        console.log("✅ pokedex.json loaded:", data);
        setCreatures(data);
      })
      .catch((err) => {
        console.error("❌ Error loading pokedex.json:", err);
      });
  }, []);

  const anchorMap = Object.fromEntries(
    creatures.map((c) => [c.name, c.name.replace(/\s+/g, '_')])
  );

  const evolvesToMap = {};
  creatures.forEach((c) => {
    if (c.evolvesFrom) {
      c.evolvesFrom.split(',').forEach(from => {
        const fromTrimmed = from.trim();
        evolvesToMap[fromTrimmed] = evolvesToMap[fromTrimmed] || [];
        evolvesToMap[fromTrimmed].push(c.name);
      });
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Group creatures under ALL their types, then sort alphabetically
  const grouped = {};
  creatures.forEach((c) => {
    const types = [c.type1, c.type2, c.type3].filter(Boolean);
    if (types.length === 0) types.push('Unknown');
    types.forEach((type) => {
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(c);
    });
  });

  // Sort creatures alphabetically inside each type
  Object.keys(grouped).forEach(type => {
    grouped[type].sort((a, b) => a.name.localeCompare(b.name));
  });

  const sortedTypes = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  return (
    <div className={styles.app}>
      <aside className={styles.sidebar} style={{ position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
        <h2>Index</h2>
        {sortedTypes.map((type) => (
          <div key={type}>
            <h3>{getTypeIcon(type)} {type}</h3>
            <ul>
              {grouped[type].map((c) => (
                <li key={c.name}>
                  <a href={`#${anchorMap[c.name]}`}>{c.name}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <button
          className={styles['toggle-theme']}
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          title="Toggle dark mode"
        >
          🌙
        </button>
      </aside>
      <main className={styles.content}>
        {creatures.map((c) => (
          <Entry
            key={c.name}
            creature={c}
            anchorMap={anchorMap}
            evolvesToMap={evolvesToMap}
          />
        ))}
      </main>
    </div>
  );
}

export default App;
