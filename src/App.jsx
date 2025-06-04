import React, { useEffect, useState } from 'react';
import styles from './App.module.css';
import './glow.css';
import { HashRouter as Router, Route, Routes, Link, useParams } from 'react-router-dom';

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
    <span className={styles.badge} style={{ backgroundColor: bgColor }}>
      {text}
    </span>
  );
}

function SummaryCard({ creature }) {
  const types = creature.types?.split(',').map(t => t.trim()) || [];
  return (
    <Link to={`/entry/${creature.name}`} className={styles.cardLink}>
      <div className={styles.summaryCard}>
        <img src={creature.image} alt={creature.name} className={styles['entry-img']} />
        <h3 className={styles.caesar}>{`#${String(creature.id).padStart(3, '0')} ${creature.name}`}</h3>
        <div>
          {types.map((t) => (
            <Badge key={t} text={t} />
          ))}
        </div>
      </div>
    </Link>
  );
}

function CreatureDetail({ creatures, reverseEvolutions }) {
  const { name } = useParams();
  const creature = creatures.find((c) => c.name === name);
  if (!creature) return <div style={{ padding: '20px' }}>Loading...</div>;
  return <EntryDetail creature={creature} reverseEvolutions={reverseEvolutions} creatures={creatures} />;
}

function App() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [creatures, setCreatures] = useState([]);
  const [sortByName, setSortByName] = useState(false);

  useEffect(() => {
    fetch('pokedex.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
        return res.json();
      })
      .then((data) => setCreatures(data))
      .catch((err) => console.error("❌ Error loading pokedex.json:", err));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  const reverseEvolutions = {};
  creatures.forEach((c) => {
    if (Array.isArray(c.evolutions)) {
      c.evolutions.forEach(([target, method, value]) => {
        if (!reverseEvolutions[target]) reverseEvolutions[target] = [];
        reverseEvolutions[target].push([c.name, method, value]);
      });
    }
  });

  const allTypes = [...new Set(creatures.flatMap(c => c.types?.split(',').map(t => t.trim()) || []))];

  const filteredCreatures = creatures.filter(c => {
    const nameMatch = c.name.toLowerCase().includes(search.toLowerCase());
    const typeMatch = !typeFilter || c.types?.split(',').map(t => t.trim()).includes(typeFilter);
    return nameMatch && typeMatch;
  });

  const sortedCreatures = [...filteredCreatures].sort((a, b) => {
    return sortByName ? a.name.localeCompare(b.name) : parseInt(a.id) - parseInt(b.id);
  });

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <div className={styles.app}>
              <aside className={styles.sidebar} style={{ position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
                <h2>Index</h2>
                <input
                  type="text"
                  placeholder="Search..."
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '6px', margin: '8px 0', borderRadius: '4px' }}
                />
                <button
                  onClick={() => setSortByName(!sortByName)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#444',
                    color: '#fff',
                    cursor: 'pointer',
                    marginBottom: '8px'
                  }}
                >
                  Sort: {sortByName ? 'A–Z' : 'By ID'}
                </button>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  <button onClick={() => setTypeFilter('')} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', backgroundColor: typeFilter === '' ? '#555' : '#333', color: '#fff', cursor: 'pointer' }}>All</button>
                  {allTypes.map(type => (
                    <button key={type} onClick={() => setTypeFilter(typeFilter === type ? '' : type)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', backgroundColor: typeFilter === type ? '#555' : '#333', color: '#fff', cursor: 'pointer' }}>{type}</button>
                  ))}
                </div>
                <ul>
                  {sortedCreatures.map((c) => (
                    <li key={`search-${c.name}`}>
                      <Link to={`/entry/${c.name}`}>{c.name}</Link>
                    </li>
                  ))}
                </ul>
              </aside>
              <main className={styles.content}>
                <div className={styles.grid}>
                  {sortedCreatures.map((c) => (
                    <SummaryCard key={c.name} creature={c} />
                  ))}
                </div>
              </main>
            </div>
          }
        />
        <Route
          path="/entry/:name"
          element={<CreatureDetail creatures={creatures} reverseEvolutions={reverseEvolutions} />}
        />
      </Routes>
    </Router>
  );
}

export default App;
