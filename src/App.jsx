import React, { useEffect, useState, useMemo } from 'react';
import { HashRouter as Router, Route, Routes, Link, useParams } from 'react-router-dom';
import styles from './App.module.css';
import './glow.css';

// ── Configuration ────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  primal:   '#c0614a',
  flora:    '#3aad5e',
  water:    '#2680d4',
  fire:     '#e8601f',
  terra:    '#8b6840',
  fae:      '#c760d4',
  dark:     '#3a2260',
  volt:     '#c9a800',
  ice:      '#58c8e8',
  flex:     '#888888',
};

const typeColor = (t) => TYPE_COLORS[t?.toLowerCase()] || 'transparent';

const getSplitList = (list) => {
  if (!list) return [];
  return list.flatMap(item => item.includes(';') ? item.split(';').map(s => s.trim()) : item);
};

// ── Badge Component ──────────────────────────────────────────────────────────
function Badge({ text, isTag = false }) {
  const items = text.includes(';') ? text.split(';').map(s => s.trim()) : [text];
  
  return (
    <>
      {items.map((t, i) => (
        <span 
          key={`${t}-${i}`} 
          className={isTag ? styles.tagBadge : styles.badge} 
          style={{ 
            backgroundColor: isTag ? 'transparent' : typeColor(t),
            border: isTag ? '1px solid rgba(255,255,255,0.3)' : 'none',
            marginRight: '4px' 
          }}
        >
          {t}
        </span>
      ))}
    </>
  );
}

// ── Stat bar ──────────────────────────────────────────────────────────────────
function StatBar({ label, value }) {
  const STAT_MAX = 45; 
  const pct = value != null ? Math.min(100, (value / STAT_MAX) * 100) : 0;
  const hasValue = value != null && value !== 0;
  
  return (
    <div className={styles.statRow}>
      <span className={styles.statLabel}>{label}</span>
      <div className={styles.statTrack}>
        {hasValue && (
          <div
            className={styles.statFill}
            style={{ 
              width: `${pct}%`, 
              backgroundColor: pct > 66 ? '#4ade80' : pct > 33 ? '#facc15' : '#f87171' 
            }}
          />
        )}
      </div>
      <span className={styles.statValue}>{hasValue ? value : '—'}</span>
    </div>
  );
}

// ── Type Matchup Section ─────────────────────────────────────────────────────
function TypeMatchup({ types }) {
  const chart = {
    volt:   { strong: ['water', 'ice'],   weak: ['terra', 'dark'] },
    water:  { strong: ['fire', 'terra'],  weak: ['flora', 'volt'] },
    flora:  { strong: ['water', 'terra'], weak: ['fire', 'ice'] },
    fire:   { strong: ['flora', 'ice'],   weak: ['water', 'terra'] },
    terra:  { strong: ['volt', 'fire'],   weak: ['water', 'flora'] },
    ice:    { strong: ['flora', 'dark'],  weak: ['fire', 'volt'] },
    dark:   { strong: ['fae', 'volt'],    weak: ['primal', 'ice'] },
    fae:    { strong: ['primal', 'terra'],weak: ['dark', 'fire'] },
    primal: { strong: ['dark', 'ice'],    weak: ['fae', 'volt'] },
  };

  const strengths = new Set();
  const weaknesses = new Set();

  types.forEach(t => {
    const data = chart[t.toLowerCase()];
    if (data) {
      data.strong.forEach(s => strengths.add(s));
      data.weak.forEach(w => weaknesses.add(w));
    }
  });

  // Pokémon-style Canceling Logic:
  // If a type is in both sets, it becomes neutral (1x), so remove it from both.
  strengths.forEach(s => {
    if (weaknesses.has(s)) {
      strengths.delete(s);
      weaknesses.delete(s);
    }
  });

  if (strengths.size === 0 && weaknesses.size === 0) return null;

  return (
    <div className={styles.statsPanel} style={{ marginTop: '20px' }}>
      <h4 className={styles.sectionTitle}>Type Matchups</h4>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '0.65rem', opacity: 0.6, letterSpacing: '1px', marginBottom: '6px' }}>STRENGTHS</div>
        {[...strengths].map(s => <Badge key={s} text={s} />)}
      </div>
      <div>
        <div style={{ fontSize: '0.65rem', opacity: 0.6, letterSpacing: '1px', marginBottom: '6px' }}>WEAKNESSES</div>
        {[...weaknesses].map(w => <Badge key={w} text={w} />)}
      </div>
    </div>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({ creature }) {
  return (
    <Link to={`/entry/${creature.name}`} className={styles.cardLink}>
      <div className={styles.summaryCard}>
        <img
          src={`${import.meta.env.BASE_URL}front/${creature.name}.png`}
          alt={creature.name}
          className={styles.cardImg}
          onError={(e) => { e.target.style.opacity = '0.2'; }}
        />
        <div className={styles.cardNum}>#{String(creature.id).padStart(3, '0')}</div>
        <h3 className={`${styles.cardName} ${styles.caesar}`}>{creature.name}</h3>
        <div className={styles.badgeRow}>
          {creature.types.map((t) => <Badge key={t} text={t} />)}
        </div>
      </div>
    </Link>
  );
}

// ── Move table ────────────────────────────────────────────────────────────────
function MovesPanel({ moveGroups, movesDb }) {
  if (!moveGroups || moveGroups.length === 0) return null;

  const sortedGroups = [...moveGroups].sort((a, b) => {
    const aIsFlex = a.toUpperCase().includes('FLEX');
    const bIsFlex = b.toUpperCase().includes('FLEX');
    if (aIsFlex && !bIsFlex) return 1;
    if (!aIsFlex && bIsFlex) return -1;
    return 0; 
  });

  const allMoves = sortedGroups.flatMap((group) => {
    const entries = movesDb[group] || [];
    return entries.map((m) => ({ ...m, group }));
  });

  return (
    <div className={styles.movesPanel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h4 className={styles.sectionTitle} style={{ margin: 0 }}>Moves</h4>
        <div>
          {sortedGroups.map(g => (
            <span key={g} className={styles.tagBadge} style={{ marginLeft: '5px', fontSize: '0.7rem' }}>{g}</span>
          ))}
        </div>
      </div>
      <table className={styles.moveTable}>
        <thead>
          <tr>
            <th>Name</th><th>Type</th><th>Cat.</th><th>PP</th><th>Pwr</th><th>Acc</th><th>Group</th>
          </tr>
        </thead>
        <tbody>
          {allMoves.map((m, i) => (
            <tr key={i}>
              <td>{m.name}</td>
              <td>
                <span className={styles.moveBadge} style={{ backgroundColor: typeColor(m.type) }}>
                  {m.type}
                </span>
              </td>
              <td className={styles.catCell}>{m.category}</td>
              <td>{m.pp}</td>
              <td>{m.power || '—'}</td>
              <td>{m.accuracy || '—'}</td>
              <td><span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{m.group}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Evolution Section ────────────────────────────────────────────────────────
function EvoChain({ creature, all }) {
  const allPossiblePaths = all.reduce((acc, curr) => {
    if (curr.evolution && Array.isArray(curr.evolution)) {
      curr.evolution.forEach(path => {
        if (path.some(name => name.toLowerCase() === creature.name.toLowerCase())) {
          acc[JSON.stringify(path)] = path;
        }
      });
    }
    return acc;
  }, {});

  const paths = Object.values(allPossiblePaths);
  if (paths.length === 0) return null;

  return (
    <div className={styles.evoSection}>
      <h4 className={styles.sectionTitle}>Evolution</h4>
      {paths.map((path, pIdx) => (
        <div key={pIdx} className={styles.evoChain}>
          {path.map((name, i) => (
            <React.Fragment key={`${pIdx}-${name}`}>
              <Link to={`/entry/${name}`} className={styles.evoLink}>
                <img
                  src={`${import.meta.env.BASE_URL}front/${name}.png`}
                  alt={name}
                  className={styles.evoImg}
                  style={{ outline: name.toLowerCase() === creature.name.toLowerCase() ? '2px solid #90cdf4' : 'none' }}
                  onError={(e) => { e.target.style.opacity = '0.2'; }}
                />
                <span className={styles.evoName}>{name}</span>
              </Link>
              {i < path.length - 1 && <span className={styles.evoArrow}>→</span>}
            </React.Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Detail page ───────────────────────────────────────────────────────────────
function CreatureDetail({ all, movesDb }) {
  const { name } = useParams();
  const creature = all.find((c) => c.name.toLowerCase() === name.toLowerCase());

  if (!creature) return <div className={styles.loadingPage}>Loading...</div>;

  const base = import.meta.env.BASE_URL;
  const stats = creature.stats || {};
  const totalStats = Object.values(stats).reduce((s, v) => s + (v || 0), 0);
  const STAT_LABELS = { hp: 'HP', atk: 'ATK', def: 'DEF', special: 'SPECIAL', spd: 'SPD' };

  return (
    <div className={styles.detailPage}>
      <Link to="/" className={styles.backLink}>← Back to index</Link>
      <div className={styles.detailCard}>
        <div className={styles.detailHeader}>
          <span className={styles.detailNum}>#{String(creature.id).padStart(3, '0')}</span>
          <h2 className={`${styles.detailName} ${styles.caesar}`}>{creature.name}</h2>
          <div className={styles.badgeRow}>
            {creature.types.map((t) => <Badge key={t} text={t} />)}
            {creature.tags.map((t) => (
              <Badge key={t} text={t} isTag={true} />
            ))}
          </div>
        </div>

        <div className={styles.imagesRow}>
          <div className={styles.mainImgWrap}>
            <img src={`${base}front/${creature.name}.png`} className={styles.mainImg} onError={(e) => { e.target.style.opacity = '0.15'; }} />
          </div>
          <div className={styles.sideImgs}>
            <img src={`${base}side/${creature.name}.png`} className={styles.secondaryImg} onError={(e) => { e.target.style.opacity = '0.15'; }} />
            <img src={`${base}back/${creature.name}.png`} className={styles.secondaryImg} onError={(e) => { e.target.style.opacity = '0.15'; }} />
          </div>
        </div>

        {creature.bio && <p className={styles.bio}>{creature.bio}</p>}

        <div className={styles.statsPanel}>
          <h4 className={styles.sectionTitle}>Base Stats <span className={styles.totalStat}>Total: {totalStats}</span></h4>
          {Object.entries(STAT_LABELS).map(([key, label]) => (
            <StatBar key={key} label={label} value={stats[key]} />
          ))}
        </div>

        <EvoChain creature={creature} all={all} />

        <TypeMatchup types={creature.types} />

        <MovesPanel moveGroups={creature.moves} movesDb={movesDb} />
      </div>
    </div>
  );
}

// ── Main index ────────────────────────────────────────────────────────────────
function IndexPage({ all }) {
  const [search, setSearch]       = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortByName, setSortByName] = useState(false);

  const allTypes = useMemo(() =>
    [...new Set(all.flatMap(c => getSplitList(c.types)))].sort(),
    [all]
  );

  const filtered = useMemo(() => {
    let list = all.filter(c => {
      const nm = c.name.toLowerCase().includes(search.toLowerCase());
      const split = getSplitList(c.types);
      const tp = !typeFilter || split.includes(typeFilter.toLowerCase());
      return nm && tp;
    });
    return [...list].sort((a, b) =>
      sortByName ? a.name.localeCompare(b.name) : parseInt(a.id) - parseInt(b.id)
    );
  }, [all, search, typeFilter, sortByName]);

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarInner}>
          <h1 className={`${styles.sidebarTitle} ${styles.caesar}`}>Codex</h1>
          <input className={styles.searchInput} type="text" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className={styles.sortBtn} onClick={() => setSortByName(s => !s)}>
            Sorting: {sortByName ? 'A–Z' : 'By #'}
          </button>
          <div className={styles.filterRow}>
            <button className={`${styles.filterBtn} ${!typeFilter ? styles.filterActive : ''}`} onClick={() => setTypeFilter('')}>All</button>
            {allTypes.map(t => (
              <button
                key={t}
                className={`${styles.filterBtn} ${typeFilter === t ? styles.filterActive : ''}`}
                style={typeFilter === t ? { backgroundColor: typeColor(t) } : {}}
                onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
              >{t}</button>
            ))}
          </div>
          <ul className={styles.nameList}>
            {filtered.map(c => (
              <li key={c.name}>
                <Link to={`/entry/${c.name}`} className={styles.nameLink}>
                  <span className={styles.nameListNum}>#{String(c.id).padStart(3,'0')}</span> {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <main className={styles.main}>
        <div className={styles.grid}>
          {filtered.map(c => <SummaryCard key={c.name} creature={c} />)}
        </div>
      </main>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [all, setAll]         = useState([]);
  const [movesDb, setMovesDb] = useState({});

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    Promise.all([
      fetch('pokedex.json').then(r => r.json()),
      fetch('moves_db.json').then(r => r.json()),
    ]).then(([poke, moves]) => {
      setAll(poke);
      setMovesDb(moves);
    }).catch(err => console.error('Load error:', err));
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<IndexPage all={all} />} />
        <Route path="/entry/:name" element={<CreatureDetail all={all} movesDb={movesDb} />} />
      </Routes>
    </Router>
  );
}