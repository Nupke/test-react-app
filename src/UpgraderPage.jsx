import { useState, useEffect, useCallback, useRef } from 'react';
import './UpgraderPage.css';

const STEAM_API_BASE = 'https://api.steampowered.com';
const STEAM_COMMUNITY_BASE = 'https://steamcommunity.com';
const STEAM_CDN = 'https://community.akamai.steamstatic.com/economy/image';
const HOUSE_EDGE = 0.92;

const UPGRADE_MULTIPLIERS = [
  { label: '1.5x', value: 1.5, chance: 66 },
  { label: '2x', value: 2, chance: 50 },
  { label: '3x', value: 3, chance: 33 },
  { label: '5x', value: 5, chance: 20 },
  { label: '10x', value: 10, chance: 10 },
];

function chanceFromRatio(inputCents, targetCents) {
  if (!inputCents || !targetCents || targetCents <= inputCents) return 0;
  return Math.min(95, Math.max(1, (inputCents / targetCents) * 100 * HOUSE_EDGE));
}

function parseMarketPrice(value) {
  if (!value) return 0;
  const match = String(value).replace(/,/g, '.').match(/[\d.]+/);
  if (!match) return 0;
  return Math.round(parseFloat(match[0]) * 100);
}

const RARITY_COLORS = {
  'Consumer Grade': '#b0c3d9',
  'Industrial Grade': '#5e98d9',
  'Mil-Spec': '#4b69ff',
  Restricted: '#8847ff',
  Classified: '#d32ce6',
  Covert: '#eb4b4b',
  Contraband: '#e4ae39',
};

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function UpgraderPage({ user, onBack, steamApiKey }) {
  const [inventory, setInventory] = useState([]);
  const [selectedSkin, setSelectedSkin] = useState(null);
  const [multiplier, setMultiplier] = useState(UPGRADE_MULTIPLIERS[1]);
  const [upgradeResult, setUpgradeResult] = useState(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [steamId, setSteamId] = useState('');
  const [steamIdInput, setSteamIdInput] = useState('');
  const [priceData, setPriceData] = useState({});
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
  const [upgradeMode, setUpgradeMode] = useState('classic');
  const [selectedSkins, setSelectedSkins] = useState([]);
  const [targetQuery, setTargetQuery] = useState('');
  const [targetResults, setTargetResults] = useState([]);
  const [targetSkin, setTargetSkin] = useState(null);
  const [targetSearching, setTargetSearching] = useState(false);
  const [marketPrices, setMarketPrices] = useState({});

  const fetchInventory = useCallback(async (id) => {
    setLoading(true);
    setError('');
    setInventory([]);
    setSelectedSkin(null);

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
        .map((item) => ({
          id: item.classid,
          assetId: item.instanceid,
          name: item.market_hash_name || item.name,
          icon: item.icon_url ? `${STEAM_CDN}/${item.icon_url}` : null,
          rarity: extractRarity(item.tags),
          type: extractType(item.tags),
          exterior: extractExterior(item.tags),
          tradable: item.tradable === 1,
          nameColor: item.name_color ? `#${item.name_color}` : null,
        }));

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

  const fetchMarketPrice = useCallback(async (marketHashName) => {
    if (!marketHashName) return 0;
    if (marketPrices[marketHashName] !== undefined) return marketPrices[marketHashName];

    try {
      const res = await fetch(
        `${STEAM_COMMUNITY_BASE}/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(marketHashName)}`
      );
      if (!res.ok) return 0;
      const data = await res.json();
      const cents = parseMarketPrice(data.lowest_price || data.median_price);
      setMarketPrices((prev) => ({ ...prev, [marketHashName]: cents }));
      return cents;
    } catch {
      return 0;
    }
  }, [marketPrices]);

  const searchTargetSkins = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setTargetResults([]);
      return;
    }
    setTargetSearching(true);
    try {
      const res = await fetch(
        `${STEAM_COMMUNITY_BASE}/market/search/render/?appid=730&norender=1&count=20&query=${encodeURIComponent(query)}`
      );
      if (!res.ok) throw new Error('Market search failed');
      const data = await res.json();
      const results = (data.results || []).map((r) => ({
        name: r.hash_name || r.name,
        icon: r.asset_description?.icon_url ? `${STEAM_CDN}/${r.asset_description.icon_url}` : null,
        priceCents: parseMarketPrice(r.sell_price_text),
        volume: r.sell_listings || 0,
        rarity: extractRarity(r.asset_description?.tags),
        exterior: extractExterior(r.asset_description?.tags),
      }));
      setTargetResults(results);
    } catch {
      setTargetResults([]);
    } finally {
      setTargetSearching(false);
    }
  }, []);

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
    }
  }, [steamId, fetchInventory]);

  useEffect(() => {
    if (steamId && steamApiKey) {
      fetchTradeOffers();
    }
  }, [steamId, steamApiKey, fetchTradeOffers]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (upgradeMode === 'target') searchTargetSkins(targetQuery);
    }, 350);
    return () => clearTimeout(handle);
  }, [targetQuery, upgradeMode, searchTargetSkins]);

  useEffect(() => {
    if (upgradeMode !== 'target') return;
    selectedSkins.forEach((s) => {
      if (marketPrices[s.name] === undefined) fetchMarketPrice(s.name);
    });
  }, [selectedSkins, upgradeMode, marketPrices, fetchMarketPrice]);

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

  const handleUpgrade = () => {
    if (!selectedSkin || isUpgrading) return;

    setIsUpgrading(true);
    setUpgradeResult(null);

    const totalRotation = 1440 + Math.random() * 720;
    setWheelAngle((prev) => prev + totalRotation);

    setTimeout(() => {
      const roll = Math.random() * 100;
      const won = roll < multiplier.chance;

      const basePrice = priceData[selectedSkin.id] || Math.floor(Math.random() * 5000) + 100;
      const upgradedPrice = Math.round(basePrice * multiplier.value);

      const result = {
        won,
        originalSkin: selectedSkin,
        originalPrice: basePrice,
        upgradedPrice: won ? upgradedPrice : 0,
        multiplier: multiplier.value,
        multiplierLabel: multiplier.label,
        roll: roll.toFixed(2),
        timestamp: new Date().toLocaleString(),
      };

      setUpgradeResult(result);
      setUpgradeHistory((prev) => [result, ...prev].slice(0, 50));
      setStats((prev) => ({
        wins: prev.wins + (won ? 1 : 0),
        losses: prev.losses + (won ? 0 : 1),
        totalSpent: prev.totalSpent + basePrice,
        totalWon: prev.totalWon + (won ? upgradedPrice : 0),
      }));

      if (won && steamApiKey && tradeUrl && selectedSkin.tradable) {
        sendTradeOffer(
          [{ appid: 730, contextid: '2', assetid: selectedSkin.assetId }],
          []
        );
      }

      setIsUpgrading(false);
    }, 2500);
  };

  const resetUpgrade = () => {
    setUpgradeResult(null);
    setSelectedSkin(null);
    setSelectedSkins([]);
    setTargetSkin(null);
  };

  const toggleMultiSelect = (item) => {
    setUpgradeResult(null);
    setSelectedSkins((prev) =>
      prev.find((s) => s.id === item.id)
        ? prev.filter((s) => s.id !== item.id)
        : [...prev, item]
    );
  };

  const inputTotalCents = selectedSkins.reduce(
    (sum, s) => sum + (marketPrices[s.name] ?? priceData[s.id] ?? 0),
    0
  );

  const targetChance = targetSkin
    ? chanceFromRatio(inputTotalCents, targetSkin.priceCents)
    : 0;

  const handleTargetUpgrade = () => {
    if (!targetSkin || selectedSkins.length === 0 || isUpgrading) return;
    if (inputTotalCents <= 0 || targetSkin.priceCents <= inputTotalCents) {
      setError('Input value must be less than target value.');
      return;
    }

    setIsUpgrading(true);
    setUpgradeResult(null);
    setWheelAngle((prev) => prev + 1440 + Math.random() * 720);

    setTimeout(() => {
      const roll = Math.random() * 100;
      const won = roll < targetChance;

      const result = {
        won,
        mode: 'target',
        inputSkins: selectedSkins,
        originalPrice: inputTotalCents,
        targetSkin,
        upgradedPrice: won ? targetSkin.priceCents : 0,
        chance: targetChance.toFixed(1),
        roll: roll.toFixed(2),
        timestamp: new Date().toLocaleString(),
      };

      setUpgradeResult(result);
      setUpgradeHistory((prev) => [
        {
          ...result,
          originalSkin: {
            name: `${selectedSkins.length} item(s)`,
            icon: selectedSkins[0]?.icon,
          },
          multiplierLabel: `→ ${targetSkin.name}`,
        },
        ...prev,
      ].slice(0, 50));
      setStats((prev) => ({
        wins: prev.wins + (won ? 1 : 0),
        losses: prev.losses + (won ? 0 : 1),
        totalSpent: prev.totalSpent + inputTotalCents,
        totalWon: prev.totalWon + (won ? targetSkin.priceCents : 0),
      }));

      if (won && steamApiKey && tradeUrl) {
        const assets = selectedSkins
          .filter((s) => s.tradable)
          .map((s) => ({ appid: 730, contextid: '2', assetid: s.assetId }));
        if (assets.length > 0) sendTradeOffer(assets, []);
      }

      setIsUpgrading(false);
    }, 2500);
  };

  const rarityColor = (rarity) => RARITY_COLORS[rarity] || '#b0c3d9';

  const filteredInventory = inventory
    .filter((item) => {
      if (!searchQuery) return true;
      return item.name.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'rarity') {
        const order = Object.keys(RARITY_COLORS);
        return order.indexOf(b.rarity) - order.indexOf(a.rarity);
      }
      if (sortBy === 'price') {
        return (priceData[b.id] || 0) - (priceData[a.id] || 0);
      }
      return 0;
    });

  const winRate = stats.wins + stats.losses > 0
    ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1)
    : '0.0';

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
            <>
              <div className="mode-toggle" role="tablist" aria-label="Upgrade mode">
                <button
                  role="tab"
                  aria-selected={upgradeMode === 'classic'}
                  className={`mode-btn ${upgradeMode === 'classic' ? 'active' : ''}`}
                  onClick={() => { setUpgradeMode('classic'); resetUpgrade(); }}
                >
                  Classic Multiplier
                </button>
                <button
                  role="tab"
                  aria-selected={upgradeMode === 'target'}
                  className={`mode-btn ${upgradeMode === 'target' ? 'active' : ''}`}
                  onClick={() => { setUpgradeMode('target'); resetUpgrade(); }}
                >
                  Target Skin (Multi-Input)
                </button>
              </div>
            <div className="upgrader-layout">
              <aside className="inventory-panel" aria-label="Inventory">
                <div className="panel-header">
                  <h2>Your Inventory</h2>
                  <span className="item-count">
                    {filteredInventory.length} items
                    {upgradeMode === 'target' && selectedSkins.length > 0 && (
                      <> &middot; {selectedSkins.length} selected</>
                    )}
                  </span>
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
                  </select>
                </div>

                {loading ? (
                  <div className="loading-state">
                    <div className="spinner" aria-label="Loading inventory" />
                    <p>Loading inventory from Steam...</p>
                  </div>
                ) : (
                  <div className="inventory-grid">
                    {filteredInventory.map((item) => {
                      const isMultiSelected = selectedSkins.some((s) => s.id === item.id);
                      const isSelected = upgradeMode === 'target'
                        ? isMultiSelected
                        : selectedSkin?.id === item.id;
                      return (
                      <button
                        key={item.id}
                        className={`inventory-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          if (upgradeMode === 'target') {
                            toggleMultiSelect(item);
                          } else {
                            setSelectedSkin(item);
                            setUpgradeResult(null);
                          }
                        }}
                        style={{ borderColor: rarityColor(item.rarity) }}
                      >
                        {item.icon ? (
                          <img src={item.icon} alt={item.name} className="item-image" />
                        ) : (
                          <div className="item-placeholder" />
                        )}
                        <span className="item-name">{item.name}</span>
                        {priceData[item.id] && (
                          <span className="item-price">{formatPrice(priceData[item.id])}</span>
                        )}
                        <span
                          className="item-rarity-dot"
                          style={{ backgroundColor: rarityColor(item.rarity) }}
                        />
                        {!item.tradable && <span className="item-lock" title="Not tradable">lock</span>}
                      </button>
                      );
                    })}
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
                      <p className="result-skin">
                        {upgradeResult.mode === 'target'
                          ? `${upgradeResult.inputSkins.length} item(s) → ${upgradeResult.targetSkin.name}`
                          : upgradeResult.originalSkin.name}
                      </p>
                      {upgradeResult.won ? (
                        <p className="result-value">
                          {formatPrice(upgradeResult.originalPrice)} &rarr;{' '}
                          {formatPrice(upgradeResult.upgradedPrice)}
                        </p>
                      ) : (
                        <p className="result-value">
                          {upgradeResult.mode === 'target'
                            ? 'Items lost in upgrade attempt'
                            : 'Skin lost in upgrade attempt'}
                        </p>
                      )}
                      <p className="result-roll">
                        Roll: {upgradeResult.roll} /{' '}
                        {upgradeResult.mode === 'target'
                          ? upgradeResult.chance
                          : multiplier.chance}
                      </p>
                      {upgradeResult.won && tradeUrl && steamApiKey && (
                        <p className="trade-status">Trade offer sent automatically</p>
                      )}
                      <button className="try-again-btn" onClick={resetUpgrade}>
                        Try Again
                      </button>
                    </div>
                  ) : upgradeMode === 'target' ? (
                    <>
                      <div className="target-upgrade-display">
                        <div className="target-inputs">
                          <p className="selector-label">Selected Items ({selectedSkins.length})</p>
                          {selectedSkins.length === 0 ? (
                            <p className="no-skin-selected">Pick items from inventory</p>
                          ) : (
                            <div className="selected-inputs-grid">
                              {selectedSkins.map((s) => (
                                <div key={s.id} className="selected-input">
                                  {s.icon && <img src={s.icon} alt={s.name} />}
                                  <span className="input-name">{s.name}</span>
                                  <span className="input-price">
                                    {formatPrice(marketPrices[s.name] ?? priceData[s.id] ?? 0)}
                                  </span>
                                  <button
                                    className="remove-input"
                                    onClick={() => toggleMultiSelect(s)}
                                    aria-label={`Remove ${s.name}`}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <p className="total-value">
                            Input total: <strong>{formatPrice(inputTotalCents)}</strong>
                          </p>
                        </div>

                        <div className="target-search">
                          <p className="selector-label">Target Skin (Steam Market)</p>
                          <input
                            type="text"
                            className="target-search-input"
                            placeholder="Search market, e.g. AWP | Dragon Lore"
                            value={targetQuery}
                            onChange={(e) => setTargetQuery(e.target.value)}
                            aria-label="Target skin search"
                          />
                          {targetSearching && <p className="search-status">Searching Steam Market…</p>}
                          {targetSkin ? (
                            <div className="target-selected">
                              {targetSkin.icon && <img src={targetSkin.icon} alt={targetSkin.name} />}
                              <div className="target-info">
                                <span className="target-name">{targetSkin.name}</span>
                                <span className="target-price">
                                  {formatPrice(targetSkin.priceCents)}
                                </span>
                                <span className="target-chance-label">
                                  Chance: {targetChance.toFixed(1)}%
                                </span>
                              </div>
                              <button
                                className="remove-input"
                                onClick={() => setTargetSkin(null)}
                                aria-label="Clear target skin"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <div className="target-results">
                              {targetResults.map((r) => (
                                <button
                                  key={r.name}
                                  className="target-result"
                                  onClick={() => setTargetSkin(r)}
                                  disabled={r.priceCents <= inputTotalCents}
                                  title={
                                    r.priceCents <= inputTotalCents
                                      ? 'Target must be worth more than input'
                                      : ''
                                  }
                                >
                                  {r.icon && <img src={r.icon} alt={r.name} />}
                                  <span className="result-name">{r.name}</span>
                                  <span className="result-price">{formatPrice(r.priceCents)}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        className="upgrade-btn"
                        onClick={handleTargetUpgrade}
                        disabled={
                          selectedSkins.length === 0 ||
                          !targetSkin ||
                          isUpgrading ||
                          targetSkin.priceCents <= inputTotalCents
                        }
                      >
                        {isUpgrading ? (
                          <span className="upgrading-text">
                            <span className="spinner small" />
                            Upgrading…
                          </span>
                        ) : (
                          `UPGRADE (${targetChance.toFixed(1)}%)`
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="upgrade-display">
                        {selectedSkin ? (
                          <div className="selected-skin-card">
                            {selectedSkin.icon ? (
                              <img
                                src={selectedSkin.icon}
                                alt={selectedSkin.name}
                                className="selected-skin-image"
                              />
                            ) : (
                              <div className="selected-skin-placeholder" />
                            )}
                            <h3>{selectedSkin.name}</h3>
                            {selectedSkin.exterior && (
                              <span className="skin-exterior">{selectedSkin.exterior}</span>
                            )}
                            {priceData[selectedSkin.id] && (
                              <span className="skin-price">
                                {formatPrice(priceData[selectedSkin.id])}
                              </span>
                            )}
                            {!selectedSkin.tradable && (
                              <span className="skin-not-tradable">Not Tradable</span>
                            )}
                          </div>
                        ) : (
                          <div className="no-skin-selected">
                            <p>Select a skin from your inventory</p>
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
                          {selectedSkin && priceData[selectedSkin.id] && (
                            <span className="target-potential">
                              {formatPrice(Math.round(priceData[selectedSkin.id] * multiplier.value))}
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
                        disabled={!selectedSkin || isUpgrading}
                      >
                        {isUpgrading ? (
                          <span className="upgrading-text">
                            <span className="spinner small" />
                            Upgrading...
                          </span>
                        ) : (
                          'UPGRADE'
                        )}
                      </button>
                    </>
                  )}
                </div>

                {selectedSkin && !upgradeResult && (
                  <div className="upgrade-info">
                    <div className="info-row">
                      <span>Item</span>
                      <span>{selectedSkin.name}</span>
                    </div>
                    <div className="info-row">
                      <span>Rarity</span>
                      <span style={{ color: rarityColor(selectedSkin.rarity) }}>
                        {selectedSkin.rarity || 'Unknown'}
                      </span>
                    </div>
                    <div className="info-row">
                      <span>Tradable</span>
                      <span>{selectedSkin.tradable ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="info-row">
                      <span>Multiplier</span>
                      <span>{multiplier.label}</span>
                    </div>
                    <div className="info-row">
                      <span>Win Chance</span>
                      <span>{multiplier.chance}%</span>
                    </div>
                    {priceData[selectedSkin.id] && (
                      <>
                        <div className="info-row">
                          <span>Current Value</span>
                          <span>{formatPrice(priceData[selectedSkin.id])}</span>
                        </div>
                        <div className="info-row highlight">
                          <span>Potential Value</span>
                          <span>
                            {formatPrice(Math.round(priceData[selectedSkin.id] * multiplier.value))}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </main>
            </div>
            </>
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
                          <span className="history-name">{entry.originalSkin.name}</span>
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

          {activeTab === 'stats' && (
            <div className="stats-panel">
              <h2>Upgrade Statistics</h2>
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

export default UpgraderPage;
