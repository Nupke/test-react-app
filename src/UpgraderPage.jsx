import { useState, useEffect, useCallback, useRef } from 'react';
import './UpgraderPage.css';

const STEAM_API_BASE = 'https://api.steampowered.com';
const STEAM_CDN = 'https://community.akamai.steamstatic.com/economy/image';
const STEAM_MARKET_BASE = 'https://steamcommunity.com/market';

const UPGRADE_MULTIPLIERS = [
  { label: '1.5x', value: 1.5, chance: 66 },
  { label: '2x', value: 2, chance: 50 },
  { label: '3x', value: 3, chance: 33 },
  { label: '5x', value: 5, chance: 20 },
  { label: '10x', value: 10, chance: 10 },
];

const RARITY_COLORS = {
  'Consumer Grade': '#b0c3d9',
  'Industrial Grade': '#5e98d9',
  'Mil-Spec': '#4b69ff',
  Restricted: '#8847ff',
  Classified: '#d32ce6',
  Covert: '#eb4b4b',
  Contraband: '#e4ae39',
};

const RARITY_ORDER = Object.keys(RARITY_COLORS);

const FLOAT_RANGES = {
  'Factory New': { min: 0.0, max: 0.07 },
  'Minimal Wear': { min: 0.07, max: 0.15 },
  'Field-Tested': { min: 0.15, max: 0.38 },
  'Well-Worn': { min: 0.38, max: 0.45 },
  'Battle-Scarred': { min: 0.45, max: 1.0 },
};

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function estimateFloat(exterior) {
  const range = FLOAT_RANGES[exterior];
  if (!range) return null;
  return range.min + Math.random() * (range.max - range.min);
}

function getFloatCondition(floatValue) {
  if (floatValue <= 0.07) return 'Factory New';
  if (floatValue <= 0.15) return 'Minimal Wear';
  if (floatValue <= 0.38) return 'Field-Tested';
  if (floatValue <= 0.45) return 'Well-Worn';
  return 'Battle-Scarred';
}

function UpgraderPage({ user, onBack, steamApiKey }) {
  const [inventory, setInventory] = useState([]);
  const [selectedSkins, setSelectedSkins] = useState([]);
  const [multiplier, setMultiplier] = useState(UPGRADE_MULTIPLIERS[1]);
  const [upgradeResult, setUpgradeResult] = useState(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [steamId, setSteamId] = useState('');
  const [steamIdInput, setSteamIdInput] = useState('');
  const [priceData, setPriceData] = useState({});
  const [marketPrices, setMarketPrices] = useState({});
  const [tradeUrl, setTradeUrl] = useState('');
  const [tradeUrlInput, setTradeUrlInput] = useState('');
  const [upgradeHistory, setUpgradeHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('upgrader');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [tradeOffers, setTradeOffers] = useState([]);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [wheelAngle, setWheelAngle] = useState(0);
  const wheelRef = useRef(null);
  const [stats, setStats] = useState({ wins: 0, losses: 0, totalSpent: 0, totalWon: 0 });
  const [playerProfile, setPlayerProfile] = useState(null);
  const [upgradeMode, setUpgradeMode] = useState('single');
  const [floatValues, setFloatValues] = useState({});
  const [tradeHistory, setTradeHistory] = useState([]);
  const [filterRarity, setFilterRarity] = useState('all');
  const [priceRange, setPriceRange] = useState({ min: 0, max: Infinity });
  const [showOnlyTradable, setShowOnlyTradable] = useState(false);

  const fetchPlayerProfile = useCallback(async (id) => {
    if (!steamApiKey) return;
    try {
      const res = await fetch(
        `${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(steamApiKey)}&steamids=${encodeURIComponent(id)}&format=json`
      );
      if (res.ok) {
        const data = await res.json();
        const players = data.response?.players;
        if (players && players.length > 0) {
          setPlayerProfile(players[0]);
        }
      }
    } catch {
      // profile fetch is best-effort
    }
  }, [steamApiKey]);

  const fetchMarketPrice = useCallback(async (marketHashName) => {
    try {
      const res = await fetch(
        `${STEAM_MARKET_BASE}/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(marketHashName)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const price = parseFloat((data.lowest_price || data.median_price || '0').replace('$', '')) * 100;
          setMarketPrices(prev => ({ ...prev, [marketHashName]: Math.round(price) }));
          return Math.round(price);
        }
      }
    } catch {
      // market price fetch is best-effort
    }
    return null;
  }, []);

  const fetchInventory = useCallback(async (id) => {
    setLoading(true);
    setError('');
    setInventory([]);
    setSelectedSkins([]);

    try {
      const inventoryRes = await fetch(
        `https://steamcommunity.com/inventory/${encodeURIComponent(id)}/730/2?l=english&count=100`
      );

      if (!inventoryRes.ok) {
        throw new Error('Failed to load CS2 inventory. Make sure the profile is public.');
      }

      const inventoryData = await inventoryRes.json();

      if (!inventoryData.descriptions || inventoryData.descriptions.length === 0) {
        throw new Error('No CS2 items found. Make sure the inventory is public.');
      }

      const items = inventoryData.descriptions
        .filter((item) => item.marketable === 1)
        .map((item) => {
          const exterior = extractExterior(item.tags);
          const floatVal = estimateFloat(exterior);
          const itemData = {
            id: item.classid,
            assetId: item.instanceid,
            name: item.market_hash_name || item.name,
            icon: item.icon_url ? `${STEAM_CDN}/${item.icon_url}` : null,
            rarity: extractRarity(item.tags),
            type: extractType(item.tags),
            exterior,
            tradable: item.tradable === 1,
            nameColor: item.name_color ? `#${item.name_color}` : null,
            collection: extractCollection(item.tags),
            weapon: extractWeapon(item.tags),
          };
          if (floatVal !== null) {
            setFloatValues(prev => ({ ...prev, [item.classid]: floatVal }));
          }
          return itemData;
        });

      setInventory(items);

      if (steamApiKey) {
        try {
          const priceRes = await fetch(
            `${STEAM_API_BASE}/ISteamEconomy/GetAssetPrices/v1/?key=${encodeURIComponent(steamApiKey)}&appid=730&language=en&format=json`
          );
          if (priceRes.ok) {
            const priceJson = await priceRes.json();
            const prices = {};
            if (priceJson.result?.assets) {
              for (const asset of priceJson.result.assets) {
                if (asset.prices?.USD) {
                  prices[asset.classid] = asset.prices.USD;
                }
              }
            }
            setPriceData(prices);
          }
        } catch {
          // price fetch is best-effort
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [steamApiKey]);

  const fetchTradeOffers = useCallback(async () => {
    if (!steamApiKey) return;
    setLoadingTrades(true);

    try {
      const res = await fetch(
        `${STEAM_API_BASE}/IEconService/GetTradeOffers/v1/?key=${encodeURIComponent(steamApiKey)}&get_received_offers=1&get_sent_offers=1&active_only=1&format=json`
      );

      if (!res.ok) {
        throw new Error('Failed to fetch trade offers');
      }

      const data = await res.json();
      const received = (data.response?.trade_offers_received || []).map((offer) => ({
        id: offer.tradeofferid,
        partner: offer.accountid_other,
        message: offer.message || 'No message',
        status: getTradeStatus(offer.trade_offer_state),
        itemsToReceive: offer.items_to_receive?.length || 0,
        itemsToGive: offer.items_to_give?.length || 0,
        timeCreated: new Date(offer.time_created * 1000).toLocaleString(),
        direction: 'received',
      }));

      const sent = (data.response?.trade_offers_sent || []).map((offer) => ({
        id: offer.tradeofferid,
        partner: offer.accountid_other,
        message: offer.message || 'No message',
        status: getTradeStatus(offer.trade_offer_state),
        itemsToReceive: offer.items_to_receive?.length || 0,
        itemsToGive: offer.items_to_give?.length || 0,
        timeCreated: new Date(offer.time_created * 1000).toLocaleString(),
        direction: 'sent',
      }));

      setTradeOffers([...received, ...sent]);
    } catch {
      setTradeOffers([]);
    } finally {
      setLoadingTrades(false);
    }
  }, [steamApiKey]);

  const fetchTradeHistory = useCallback(async () => {
    if (!steamApiKey) return;
    try {
      const res = await fetch(
        `${STEAM_API_BASE}/IEconService/GetTradeHistory/v1/?key=${encodeURIComponent(steamApiKey)}&max_trades=20&get_descriptions=1&format=json`
      );
      if (res.ok) {
        const data = await res.json();
        const trades = (data.response?.trades || []).map(trade => ({
          id: trade.tradeid,
          partner: trade.steamid_other,
          timeInit: new Date(trade.time_init * 1000).toLocaleString(),
          status: trade.status === 1 ? 'Completed' : 'Other',
          assetsGiven: trade.assets_given?.length || 0,
          assetsReceived: trade.assets_received?.length || 0,
        }));
        setTradeHistory(trades);
      }
    } catch {
      // trade history is best-effort
    }
  }, [steamApiKey]);

  const sendTradeOffer = useCallback(async (itemsToGive, itemsToReceive) => {
    if (!steamApiKey || !tradeUrl) {
      setError('Trade URL and Steam API key are required to send trade offers.');
      return null;
    }

    try {
      const tradeUrlMatch = tradeUrl.match(/partner=(\d+)&token=([a-zA-Z0-9_-]+)/);
      if (!tradeUrlMatch) {
        setError('Invalid trade URL format.');
        return null;
      }

      const res = await fetch(
        `${STEAM_API_BASE}/IEconService/SendTradeOffer/v1/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            key: steamApiKey,
            tradeoffermessage: 'CS2 Skin Upgrader trade offer',
            partner: tradeUrlMatch[1],
            trade_offer_access_token: tradeUrlMatch[2],
            json_tradeoffer: JSON.stringify({
              newversion: true,
              version: 4,
              me: { assets: itemsToGive, currency: [], ready: false },
              them: { assets: itemsToReceive, currency: [], ready: false },
            }),
          }),
        }
      );

      if (!res.ok) {
        throw new Error('Failed to send trade offer');
      }

      return await res.json();
    } catch (err) {
      setError(`Trade offer failed: ${err.message}`);
      return null;
    }
  }, [steamApiKey, tradeUrl]);

  useEffect(() => {
    if (steamId) {
      fetchInventory(steamId);
      fetchPlayerProfile(steamId);
    }
  }, [steamId, fetchInventory, fetchPlayerProfile]);

  useEffect(() => {
    if (steamId && steamApiKey) {
      fetchTradeOffers();
      fetchTradeHistory();
    }
  }, [steamId, steamApiKey, fetchTradeOffers, fetchTradeHistory]);

  const handleSteamIdSubmit = (e) => {
    e.preventDefault();
    if (steamIdInput.trim()) {
      setSteamId(steamIdInput.trim());
    }
  };

  const handleTradeUrlSubmit = (e) => {
    e.preventDefault();
    if (tradeUrlInput.trim()) {
      setTradeUrl(tradeUrlInput.trim());
    }
  };

  const toggleSkinSelection = (item) => {
    if (upgradeMode === 'single') {
      setSelectedSkins([item]);
      setUpgradeResult(null);
      return;
    }
    setSelectedSkins(prev => {
      const exists = prev.find(s => s.id === item.id);
      if (exists) return prev.filter(s => s.id !== item.id);
      if (prev.length >= 5) return prev;
      return [...prev, item];
    });
    setUpgradeResult(null);
  };

  const getItemPrice = (item) => {
    return marketPrices[item.name] || priceData[item.id] || 0;
  };

  const getTotalSelectedValue = () => {
    return selectedSkins.reduce((sum, skin) => sum + getItemPrice(skin), 0);
  };

  const handleUpgrade = () => {
    if (selectedSkins.length === 0 || isUpgrading) return;

    setIsUpgrading(true);
    setUpgradeResult(null);

    const totalRotation = 1440 + Math.random() * 720;
    setWheelAngle((prev) => prev + totalRotation);

    setTimeout(() => {
      const roll = Math.random() * 100;
      const won = roll < multiplier.chance;

      const totalValue = selectedSkins.reduce((sum, skin) => {
        return sum + (getItemPrice(skin) || Math.floor(Math.random() * 5000) + 100);
      }, 0);
      const upgradedPrice = Math.round(totalValue * multiplier.value);

      const result = {
        won,
        skins: selectedSkins,
        originalSkin: selectedSkins[0],
        originalPrice: totalValue,
        upgradedPrice: won ? upgradedPrice : 0,
        multiplier: multiplier.value,
        multiplierLabel: multiplier.label,
        roll: roll.toFixed(2),
        timestamp: new Date().toLocaleString(),
        mode: upgradeMode,
        skinCount: selectedSkins.length,
      };

      setUpgradeResult(result);
      setUpgradeHistory((prev) => [result, ...prev].slice(0, 50));
      setStats((prev) => ({
        wins: prev.wins + (won ? 1 : 0),
        losses: prev.losses + (won ? 0 : 1),
        totalSpent: prev.totalSpent + totalValue,
        totalWon: prev.totalWon + (won ? upgradedPrice : 0),
      }));

      if (won && steamApiKey && tradeUrl) {
        const tradableItems = selectedSkins
          .filter(s => s.tradable)
          .map(s => ({ appid: 730, contextid: '2', assetid: s.assetId }));
        if (tradableItems.length > 0) {
          sendTradeOffer(tradableItems, []);
        }
      }

      setIsUpgrading(false);
    }, 2500);
  };

  const handleFetchMarketPrice = (item) => {
    if (!marketPrices[item.name]) {
      fetchMarketPrice(item.name);
    }
  };

  const resetUpgrade = () => {
    setUpgradeResult(null);
    setSelectedSkins([]);
  };

  const rarityColor = (rarity) => RARITY_COLORS[rarity] || '#b0c3d9';

  const filteredInventory = inventory
    .filter((item) => {
      if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterRarity !== 'all' && item.rarity !== filterRarity) return false;
      if (showOnlyTradable && !item.tradable) return false;
      const price = getItemPrice(item);
      if (price > 0 && (price < priceRange.min || price > priceRange.max)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'rarity') {
        return RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity);
      }
      if (sortBy === 'price') {
        return (getItemPrice(b)) - (getItemPrice(a));
      }
      if (sortBy === 'float') {
        return (floatValues[a.id] || 1) - (floatValues[b.id] || 1);
      }
      return 0;
    });

  const winRate = stats.wins + stats.losses > 0
    ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1)
    : '0.0';

  const selectedSkin = selectedSkins[0] || null;

  return (
    <div className="upgrader">
      <header className="upgrader-header">
        <div className="upgrader-header-left">
          <h1 className="upgrader-title">CS2 Skin Upgrader</h1>
          <p className="upgrader-subtitle">
            Upgrade your CS2 skins with Steam API trading integration
          </p>
        </div>
        <div className="upgrader-header-right">
          {playerProfile && (
            <div className="player-profile">
              <img
                src={playerProfile.avatar}
                alt={playerProfile.personaname}
                className="player-avatar"
              />
              <span className="player-name">{playerProfile.personaname}</span>
              <span className={`player-status ${playerProfile.personastate === 1 ? 'online' : 'offline'}`}>
                {playerProfile.personastate === 1 ? 'Online' : 'Offline'}
              </span>
            </div>
          )}
          <span className="upgrader-user">{user}</span>
          <button className="upgrader-back-btn" onClick={onBack}>
            Back
          </button>
        </div>
      </header>

      {!steamId ? (
        <section className="steam-connect" aria-label="Connect Steam">
          <div className="connect-card">
            <div className="connect-icon">
              <svg viewBox="0 0 256 259" width="64" height="64">
                <path d="M128.006 0C60.564 0 5.17 50.484.29 114.952l68.89 28.467c5.942-4.068 13.108-6.45 20.826-6.45.688 0 1.368.025 2.044.066l31.18-45.17v-.634c0-26.398 21.482-47.878 47.878-47.878 26.398 0 47.88 21.48 47.88 47.878s-21.482 47.98-47.88 47.98h-1.088l-44.44 31.72c0 .524.034 1.046.034 1.576 0 19.818-16.104 35.914-35.916 35.914-17.386 0-31.92-12.384-35.246-28.802L5.516 156.87C23.992 213.692 77.376 255.358 140.15 258.16l.05-.05c66.342-2.834 121.1-49.596 134.626-111.358 1.608-7.358 2.542-14.972 2.774-22.77.1-2.756.15-5.47.15-8.24v-.004C277.75 51.794 209.252 0 128.006 0z" fill="#1b2838"/>
                <path d="M88.478 208.014l-15.6-6.45c3.734 7.72 10.91 13.624 19.666 15.828 18.972 4.77 38.248-6.696 43.01-25.646 2.314-9.186 1.6-18.798-2.01-27.064-3.606-8.266-10.126-14.602-18.36-16.924a35.593 35.593 0 0 0-18.524-.87l16.116 6.664c14 5.786 20.644 21.752 14.856 35.654-5.786 13.896-21.67 20.548-35.654 14.808z" fill="#a3cfed"/>
                <path d="M220.988 139.262c0-17.586-14.312-31.896-31.898-31.896-17.586 0-31.898 14.31-31.898 31.896 0 17.588 14.312 31.898 31.898 31.898 17.586 0 31.898-14.31 31.898-31.898zm-55.628.04c0-13.118 10.63-23.788 23.79-23.788 13.16 0 23.788 10.67 23.788 23.788 0 13.118-10.628 23.788-23.788 23.788-13.16 0-23.79-10.67-23.79-23.788z" fill="#a3cfed"/>
              </svg>
            </div>
            <h2>Connect Your Steam Account</h2>
            <p>Enter your Steam ID (SteamID64) to load your CS2 inventory</p>
            <form className="steam-id-form" onSubmit={handleSteamIdSubmit}>
              <input
                type="text"
                placeholder="Enter Steam ID (e.g., 76561198012345678)"
                value={steamIdInput}
                onChange={(e) => setSteamIdInput(e.target.value)}
                required
                aria-label="Steam ID"
              />
              <button type="submit">Load Inventory</button>
            </form>
            <div className="trade-url-section">
              <p className="trade-url-label">Trade URL (optional, for auto-trading)</p>
              <form className="steam-id-form" onSubmit={handleTradeUrlSubmit}>
                <input
                  type="text"
                  placeholder="https://steamcommunity.com/tradeoffer/new/?partner=...&token=..."
                  value={tradeUrlInput}
                  onChange={(e) => setTradeUrlInput(e.target.value)}
                  aria-label="Trade URL"
                />
                <button type="submit">Save</button>
              </form>
            </div>
            <p className="connect-hint">
              Steam API Key: {steamApiKey ? 'Connected' : 'Not configured'}
              {tradeUrl && ' | Trade URL: Saved'}
            </p>
          </div>
        </section>
      ) : (
        <>
          <nav className="upgrader-tabs">
            <button
              className={`tab-btn ${activeTab === 'upgrader' ? 'active' : ''}`}
              onClick={() => setActiveTab('upgrader')}
            >
              Upgrader
            </button>
            <button
              className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              History ({upgradeHistory.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'trades' ? 'active' : ''}`}
              onClick={() => setActiveTab('trades')}
            >
              Trade Offers ({tradeOffers.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'trade-history' ? 'active' : ''}`}
              onClick={() => setActiveTab('trade-history')}
            >
              Trade History
            </button>
            <button
              className={`tab-btn ${activeTab === 'market' ? 'active' : ''}`}
              onClick={() => setActiveTab('market')}
            >
              Market Prices
            </button>
            <button
              className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
              onClick={() => setActiveTab('stats')}
            >
              Stats
            </button>
          </nav>

          {error && (
            <div className="upgrader-error" role="alert">
              {error}
              <button onClick={() => { setError(''); fetchInventory(steamId); }}>Retry</button>
            </div>
          )}

          {activeTab === 'upgrader' && (
            <div className="upgrader-layout">
              <aside className="inventory-panel" aria-label="Inventory">
                <div className="panel-header">
                  <h2>Your Inventory</h2>
                  <span className="item-count">{filteredInventory.length} items</span>
                </div>

                <div className="mode-toggle">
                  <button
                    className={`mode-btn ${upgradeMode === 'single' ? 'active' : ''}`}
                    onClick={() => { setUpgradeMode('single'); setSelectedSkins([]); }}
                  >
                    Single
                  </button>
                  <button
                    className={`mode-btn ${upgradeMode === 'batch' ? 'active' : ''}`}
                    onClick={() => { setUpgradeMode('batch'); setSelectedSkins([]); }}
                  >
                    Batch (up to 5)
                  </button>
                </div>

                <div className="inventory-controls">
                  <input
                    type="text"
                    className="inventory-search"
                    placeholder="Search skins..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search inventory"
                  />
                  <select
                    className="inventory-sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    aria-label="Sort inventory"
                  >
                    <option value="name">Name</option>
                    <option value="rarity">Rarity</option>
                    <option value="price">Price</option>
                    <option value="float">Float</option>
                  </select>
                </div>

                <div className="inventory-filters">
                  <select
                    className="filter-rarity"
                    value={filterRarity}
                    onChange={(e) => setFilterRarity(e.target.value)}
                    aria-label="Filter by rarity"
                  >
                    <option value="all">All Rarities</option>
                    {RARITY_ORDER.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <label className="tradable-filter">
                    <input
                      type="checkbox"
                      checked={showOnlyTradable}
                      onChange={(e) => setShowOnlyTradable(e.target.checked)}
                    />
                    Tradable only
                  </label>
                </div>

                {loading ? (
                  <div className="loading-state">
                    <div className="spinner" aria-label="Loading inventory" />
                    <p>Loading inventory from Steam...</p>
                  </div>
                ) : (
                  <div className="inventory-grid">
                    {filteredInventory.map((item) => (
                      <button
                        key={item.id}
                        className={`inventory-item ${selectedSkins.find(s => s.id === item.id) ? 'selected' : ''}`}
                        onClick={() => toggleSkinSelection(item)}
                        onMouseEnter={() => handleFetchMarketPrice(item)}
                        style={{ borderColor: rarityColor(item.rarity) }}
                      >
                        {item.icon ? (
                          <img src={item.icon} alt={item.name} className="item-image" />
                        ) : (
                          <div className="item-placeholder" />
                        )}
                        <span className="item-name">{item.name}</span>
                        {(marketPrices[item.name] || priceData[item.id]) && (
                          <span className="item-price">
                            {formatPrice(marketPrices[item.name] || priceData[item.id])}
                          </span>
                        )}
                        {floatValues[item.id] && (
                          <span className="item-float" title={`Float: ${floatValues[item.id].toFixed(6)}`}>
                            FV: {floatValues[item.id].toFixed(4)}
                          </span>
                        )}
                        <span
                          className="item-rarity-dot"
                          style={{ backgroundColor: rarityColor(item.rarity) }}
                        />
                        {!item.tradable && <span className="item-lock" title="Not tradable">lock</span>}
                      </button>
                    ))}
                    {!loading && filteredInventory.length === 0 && !error && (
                      <p className="empty-inventory">
                        {searchQuery ? 'No items match your search' : 'No marketable items found'}
                      </p>
                    )}
                  </div>
                )}
              </aside>

              <main className="upgrade-panel" aria-label="Upgrade">
                <div className="upgrade-machine">
                  {upgradeResult ? (
                    <div className={`upgrade-result ${upgradeResult.won ? 'win' : 'lose'}`}>
                      <div className="result-icon">{upgradeResult.won ? 'WIN' : 'LOST'}</div>
                      <h3>{upgradeResult.won ? 'Upgrade Successful!' : 'Upgrade Failed'}</h3>
                      {upgradeResult.mode === 'batch' && (
                        <p className="result-batch-info">
                          {upgradeResult.skinCount} skins in batch upgrade
                        </p>
                      )}
                      <div className="result-skins">
                        {upgradeResult.skins.map(skin => (
                          <span key={skin.id} className="result-skin-tag">{skin.name}</span>
                        ))}
                      </div>
                      {upgradeResult.won ? (
                        <p className="result-value">
                          {formatPrice(upgradeResult.originalPrice)} &rarr;{' '}
                          {formatPrice(upgradeResult.upgradedPrice)}
                        </p>
                      ) : (
                        <p className="result-value">Skins lost in upgrade attempt</p>
                      )}
                      <p className="result-roll">
                        Roll: {upgradeResult.roll} / {multiplier.chance}
                      </p>
                      {upgradeResult.won && tradeUrl && steamApiKey && (
                        <p className="trade-status">Trade offer sent automatically</p>
                      )}
                      <button className="try-again-btn" onClick={resetUpgrade}>
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="upgrade-display">
                        {selectedSkins.length > 0 ? (
                          <div className="selected-skins-area">
                            {selectedSkins.map(skin => (
                              <div key={skin.id} className="selected-skin-card">
                                {skin.icon ? (
                                  <img
                                    src={skin.icon}
                                    alt={skin.name}
                                    className="selected-skin-image"
                                  />
                                ) : (
                                  <div className="selected-skin-placeholder" />
                                )}
                                <h3>{skin.name}</h3>
                                {skin.exterior && (
                                  <span className="skin-exterior">{skin.exterior}</span>
                                )}
                                {floatValues[skin.id] && (
                                  <span className="skin-float">
                                    Float: {floatValues[skin.id].toFixed(6)}
                                  </span>
                                )}
                                {getItemPrice(skin) > 0 && (
                                  <span className="skin-price">
                                    {formatPrice(getItemPrice(skin))}
                                  </span>
                                )}
                                {!skin.tradable && (
                                  <span className="skin-not-tradable">Not Tradable</span>
                                )}
                              </div>
                            ))}
                            {upgradeMode === 'batch' && selectedSkins.length > 1 && (
                              <div className="batch-total">
                                Total: {formatPrice(getTotalSelectedValue())}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="no-skin-selected">
                            <p>
                              {upgradeMode === 'batch'
                                ? 'Select up to 5 skins from your inventory'
                                : 'Select a skin from your inventory'}
                            </p>
                          </div>
                        )}

                        <div className="upgrade-wheel-container">
                          <div
                            ref={wheelRef}
                            className={`upgrade-wheel ${isUpgrading ? 'spinning' : ''}`}
                            style={{ transform: `rotate(${wheelAngle}deg)` }}
                          >
                            <div className="wheel-segment win-segment" style={{ '--seg-angle': `${(multiplier.chance / 100) * 360}deg` }} />
                            <div className="wheel-segment lose-segment" />
                            <div className="wheel-center">
                              <span>{multiplier.label}</span>
                            </div>
                          </div>
                          <div className="wheel-pointer" />
                        </div>

                        <div className="upgrade-target">
                          <div className="target-glow" />
                          <span className="target-multiplier">{multiplier.label}</span>
                          <span className="target-chance">{multiplier.chance}% chance</span>
                          {getTotalSelectedValue() > 0 && (
                            <span className="target-potential">
                              {formatPrice(Math.round(getTotalSelectedValue() * multiplier.value))}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="multiplier-selector">
                        <p className="selector-label">Select Multiplier</p>
                        <div className="multiplier-buttons">
                          {UPGRADE_MULTIPLIERS.map((m) => (
                            <button
                              key={m.value}
                              className={`multiplier-btn ${multiplier.value === m.value ? 'active' : ''}`}
                              onClick={() => setMultiplier(m)}
                            >
                              <span className="mult-value">{m.label}</span>
                              <span className="mult-chance">{m.chance}%</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        className="upgrade-btn"
                        onClick={handleUpgrade}
                        disabled={selectedSkins.length === 0 || isUpgrading}
                      >
                        {isUpgrading ? (
                          <span className="upgrading-text">
                            <span className="spinner small" />
                            Upgrading...
                          </span>
                        ) : upgradeMode === 'batch' && selectedSkins.length > 1 ? (
                          `UPGRADE ${selectedSkins.length} SKINS`
                        ) : (
                          'UPGRADE'
                        )}
                      </button>
                    </>
                  )}
                </div>

                {selectedSkins.length > 0 && !upgradeResult && (
                  <div className="upgrade-info">
                    <div className="info-row">
                      <span>Items</span>
                      <span>{selectedSkins.length} selected</span>
                    </div>
                    <div className="info-row">
                      <span>Mode</span>
                      <span>{upgradeMode === 'batch' ? 'Batch Upgrade' : 'Single Upgrade'}</span>
                    </div>
                    {selectedSkin && (
                      <div className="info-row">
                        <span>Rarity</span>
                        <span style={{ color: rarityColor(selectedSkin.rarity) }}>
                          {selectedSkin.rarity || 'Unknown'}
                        </span>
                      </div>
                    )}
                    {selectedSkin && floatValues[selectedSkin.id] && (
                      <div className="info-row">
                        <span>Float Value</span>
                        <span>{floatValues[selectedSkin.id].toFixed(6)}</span>
                      </div>
                    )}
                    <div className="info-row">
                      <span>Tradable</span>
                      <span>
                        {selectedSkins.filter(s => s.tradable).length}/{selectedSkins.length}
                      </span>
                    </div>
                    <div className="info-row">
                      <span>Multiplier</span>
                      <span>{multiplier.label}</span>
                    </div>
                    <div className="info-row">
                      <span>Win Chance</span>
                      <span>{multiplier.chance}%</span>
                    </div>
                    {getTotalSelectedValue() > 0 && (
                      <>
                        <div className="info-row">
                          <span>Total Value</span>
                          <span>{formatPrice(getTotalSelectedValue())}</span>
                        </div>
                        <div className="info-row highlight">
                          <span>Potential Value</span>
                          <span>
                            {formatPrice(Math.round(getTotalSelectedValue() * multiplier.value))}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </main>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="history-panel">
              <h2>Upgrade History</h2>
              {upgradeHistory.length === 0 ? (
                <p className="empty-state">No upgrades yet. Start upgrading skins!</p>
              ) : (
                <div className="history-list">
                  {upgradeHistory.map((entry, i) => (
                    <div key={i} className={`history-entry ${entry.won ? 'win' : 'lose'}`}>
                      <div className="history-skin">
                        {entry.originalSkin.icon && (
                          <img src={entry.originalSkin.icon} alt={entry.originalSkin.name} />
                        )}
                        <div>
                          <span className="history-name">
                            {entry.mode === 'batch' && entry.skinCount > 1
                              ? `${entry.skinCount} skins (${entry.originalSkin.name}...)`
                              : entry.originalSkin.name}
                          </span>
                          <span className="history-time">{entry.timestamp}</span>
                        </div>
                      </div>
                      <div className="history-details">
                        <span className="history-multiplier">{entry.multiplierLabel}</span>
                        <span className={`history-result ${entry.won ? 'win' : 'lose'}`}>
                          {entry.won
                            ? `+${formatPrice(entry.upgradedPrice - entry.originalPrice)}`
                            : `-${formatPrice(entry.originalPrice)}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'trades' && (
            <div className="trades-panel">
              <div className="trades-header">
                <h2>Trade Offers</h2>
                <button
                  className="refresh-btn"
                  onClick={fetchTradeOffers}
                  disabled={loadingTrades}
                >
                  {loadingTrades ? 'Loading...' : 'Refresh'}
                </button>
              </div>
              {!steamApiKey ? (
                <p className="empty-state">Steam API key required to view trade offers.</p>
              ) : tradeOffers.length === 0 ? (
                <p className="empty-state">No active trade offers.</p>
              ) : (
                <div className="trade-list">
                  {tradeOffers.map((offer) => (
                    <div key={offer.id} className={`trade-entry ${offer.direction}`}>
                      <div className="trade-info">
                        <span className="trade-direction">
                          {offer.direction === 'received' ? 'Incoming' : 'Outgoing'}
                        </span>
                        <span className="trade-id">#{offer.id}</span>
                      </div>
                      <div className="trade-items">
                        <span>Give: {offer.itemsToGive} items</span>
                        <span>Receive: {offer.itemsToReceive} items</span>
                      </div>
                      <div className="trade-meta">
                        <span className={`trade-status status-${offer.status.toLowerCase()}`}>
                          {offer.status}
                        </span>
                        <span className="trade-time">{offer.timeCreated}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'trade-history' && (
            <div className="trades-panel">
              <div className="trades-header">
                <h2>Trade History</h2>
                <button
                  className="refresh-btn"
                  onClick={fetchTradeHistory}
                >
                  Refresh
                </button>
              </div>
              {!steamApiKey ? (
                <p className="empty-state">Steam API key required to view trade history.</p>
              ) : tradeHistory.length === 0 ? (
                <p className="empty-state">No trade history found.</p>
              ) : (
                <div className="trade-list">
                  {tradeHistory.map((trade) => (
                    <div key={trade.id} className="trade-entry">
                      <div className="trade-info">
                        <span className="trade-direction">Trade #{trade.id}</span>
                        <span className="trade-id">Partner: {trade.partner}</span>
                      </div>
                      <div className="trade-items">
                        <span>Given: {trade.assetsGiven} items</span>
                        <span>Received: {trade.assetsReceived} items</span>
                      </div>
                      <div className="trade-meta">
                        <span className={`trade-status status-${trade.status.toLowerCase()}`}>
                          {trade.status}
                        </span>
                        <span className="trade-time">{trade.timeInit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'market' && (
            <div className="market-panel">
              <h2>Market Price Checker</h2>
              <p className="market-hint">
                Hover over items in the inventory or click below to check live Steam Community Market prices.
              </p>
              <div className="market-grid">
                {inventory.slice(0, 20).map((item) => (
                  <div key={item.id} className="market-item">
                    {item.icon && (
                      <img src={item.icon} alt={item.name} className="market-item-image" />
                    )}
                    <div className="market-item-info">
                      <span className="market-item-name">{item.name}</span>
                      <span
                        className="market-item-rarity"
                        style={{ color: rarityColor(item.rarity) }}
                      >
                        {item.rarity}
                      </span>
                      {item.exterior && (
                        <span className="market-item-exterior">{item.exterior}</span>
                      )}
                      {floatValues[item.id] && (
                        <span className="market-item-float">
                          Float: {floatValues[item.id].toFixed(6)} ({getFloatCondition(floatValues[item.id])})
                        </span>
                      )}
                    </div>
                    <div className="market-item-prices">
                      {marketPrices[item.name] ? (
                        <span className="market-price">{formatPrice(marketPrices[item.name])}</span>
                      ) : (
                        <button
                          className="fetch-price-btn"
                          onClick={() => fetchMarketPrice(item.name)}
                        >
                          Check Price
                        </button>
                      )}
                      {priceData[item.id] && (
                        <span className="api-price">API: {formatPrice(priceData[item.id])}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="stats-panel">
              <h2>Upgrade Statistics</h2>
              {playerProfile && (
                <div className="profile-stats-card">
                  <img
                    src={playerProfile.avatarfull || playerProfile.avatar}
                    alt={playerProfile.personaname}
                    className="profile-stats-avatar"
                  />
                  <div className="profile-stats-info">
                    <h3>{playerProfile.personaname}</h3>
                    <span>Steam ID: {steamId}</span>
                    {playerProfile.loccountrycode && (
                      <span>Country: {playerProfile.loccountrycode}</span>
                    )}
                    <span>
                      Profile: {playerProfile.communityvisibilitystate === 3 ? 'Public' : 'Private'}
                    </span>
                  </div>
                </div>
              )}
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-value">{stats.wins + stats.losses}</span>
                  <span className="stat-label">Total Upgrades</span>
                </div>
                <div className="stat-card win">
                  <span className="stat-value">{stats.wins}</span>
                  <span className="stat-label">Wins</span>
                </div>
                <div className="stat-card lose">
                  <span className="stat-value">{stats.losses}</span>
                  <span className="stat-label">Losses</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{winRate}%</span>
                  <span className="stat-label">Win Rate</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{formatPrice(stats.totalSpent)}</span>
                  <span className="stat-label">Total Spent</span>
                </div>
                <div className="stat-card highlight">
                  <span className="stat-value">{formatPrice(stats.totalWon)}</span>
                  <span className="stat-label">Total Won</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">
                    {formatPrice(stats.totalWon - stats.totalSpent)}
                  </span>
                  <span className="stat-label">Net Profit/Loss</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{inventory.length}</span>
                  <span className="stat-label">Inventory Items</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function getTradeStatus(state) {
  const statuses = {
    1: 'Invalid',
    2: 'Active',
    3: 'Accepted',
    4: 'Countered',
    5: 'Expired',
    6: 'Canceled',
    7: 'Declined',
    8: 'InvalidItems',
    9: 'NeedsConfirmation',
    10: 'CanceledBySecondFactor',
    11: 'InEscrow',
  };
  return statuses[state] || 'Unknown';
}

function extractRarity(tags) {
  if (!tags) return '';
  const tag = tags.find((t) => t.category === 'Rarity');
  return tag?.localized_tag_name || '';
}

function extractType(tags) {
  if (!tags) return '';
  const tag = tags.find((t) => t.category === 'Type');
  return tag?.localized_tag_name || '';
}

function extractExterior(tags) {
  if (!tags) return '';
  const tag = tags.find((t) => t.category === 'Exterior');
  return tag?.localized_tag_name || '';
}

function extractCollection(tags) {
  if (!tags) return '';
  const tag = tags.find((t) => t.category === 'ItemSet');
  return tag?.localized_tag_name || '';
}

function extractWeapon(tags) {
  if (!tags) return '';
  const tag = tags.find((t) => t.category === 'Weapon');
  return tag?.localized_tag_name || '';
}

export default UpgraderPage;
