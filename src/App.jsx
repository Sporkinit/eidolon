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

function EntryDetail({ creature, reverseEvolutions, creatures }) {
  const { name, image, evolutions, pokedex } = creature;
  const types = creature.types?.split(',').map(t => t.trim()) || [];

  const buildChains = () => {
    const chains = [];
    const visited = new Set();

    const dfs = (path, currentName) => {
      const current = creatures.find(c => c.name === currentName);
      const evols = Array.isArray(current?.evolutions) ? current.evolutions : [];

      if (evols.length === 0) {
        chains.push(path);
      } else {
        evols.forEach(([next, method, value]) => {
          dfs([...path, method, value, next], next);
        });
      }
    };

    // Look for all reverse chains into this creature
    const collectReverse = (name, path = [name]) => {
      const revs = reverseEvolutions[name] || [];
      if (revs.length === 0) return [path];
      const out = [];
      for (const [prev, method, value] of revs) {
        const nextPath = [prev, method, value, ...path];
        out.push(...collectReverse(prev, nextPath));
      }
      return out;
    };

    const backChains = collectReverse(name);
    for (const base of backChains) {
      dfs(base, base[base.length - 1]);
    }

    if (chains.length === 0) {
      dfs([name], name);
    }

    return chains;
  };

  const chains = buildChains();

  return (
    <div className={styles.entryDetail}>
      <div style={{ position: 'absolute', top: '20px', left: '20px' }}>
        <Link to="/" style={{ color: '#90cdf4' }}>← Back to index</Link>
      </div>
      <img src={`${import.meta.env.BASE_URL}combined/${name}.png`} alt={name} className={styles['entry-img']} style={{ width: '400px', height: '200px', objectFit: 'contain' }} />
      <h2 className={styles.caesar}>{`#${String(creature.id).padStart(3, '0')} ${name}`}</h2>
      <div>
        {types.map((t) => (
          <Badge key={t} text={t} />
        ))}
      </div>
      {pokedex && <p style={{ marginTop: '8px', color: '#ccc' }}>{pokedex}</p>}
      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {chains.map((chain, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: idx > 0 ? '8px' : 0 }}>
            {chain.map((el, i) => {
              if (i % 3 === 0) {
                return (
                  <React.Fragment key={i}>
                    <Link to={`/entry/${el}`}><img src={`${import.meta.env.BASE_URL}${el}.png`} alt={el} style={{ width: '120px', height: '120px', objectFit: 'contain' }} /></Link>
                  </React.Fragment>
                );
              } else if ((i - 1) % 3 === 0) {
                const method = chain[i];
                const value = chain[i + 1];
                return (
                  <span key={i} className={styles.caesar} style={{ color: '#ccc', fontSize: '16px' }}>
			  → 	{method === 'Level' ? 'Lv.' : ''} {value}
				  </span>
                );
              } else {
                return null;
              }
            })}
          </div>
        ))}
      </div>
    </div>
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  <button onClick={() => setTypeFilter('')} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', backgroundColor: typeFilter === '' ? '#555' : '#333', color: '#fff', cursor: 'pointer' }}>All</button>
                  {allTypes.map(type => (
                    <button key={type} onClick={() => setTypeFilter(typeFilter === type ? '' : type)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', backgroundColor: typeFilter === type ? '#555' : '#333', color: '#fff', cursor: 'pointer' }}>{type}</button>
                  ))}
                </div>
                <ul>
                  {filteredCreatures
                    .slice(0, 8)
                    .map((c) => (
                      <li key={`search-${c.name}`}>
                        <Link to={`/entry/${c.name}`}>{c.name}</Link>
                      </li>
                    ))}
                </ul>
              </aside>
              <main className={styles.content}>
                <div className={styles.grid}>
                  {filteredCreatures.map((c) => (
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
