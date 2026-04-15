import { useState, useEffect, useCallback } from 'react';
import './UpgraderPage.css';

const STEAM_API_BASE = 'https://api.steampowered.com';
const STEAM_CDN = 'https://community.akamai.steamstatic.com/economy/image';

const UPGRADE_MULTIPLIERS = [
  { label: '1.5x', value: 1.5, chance: 66 },
  { label: '2x', value: 2, chance: 50 },
  { label: '3x', value: 3, chance: 33 },
  { label: '5x', value: 5, chance: 20 },
  { label: '10x', value: 10, chance: 10 },
];

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

  const fetchInventory = useCallback(async (id) => {
    setLoading(true);
    setError('');
    setInventory([]);
    setSelectedSkin(null);

    try {
      const res = await fetch(
        `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/?key=${steamApiKey}&steamid=${id}&include_appinfo=1&format=json`
      );

      if (!res.ok) {
        throw new Error(`Steam API returned ${res.status}`);
      }

      const data = await res.json();

      const inventoryRes = await fetch(
        `https://steamcommunity.com/inventory/${id}/730/2?l=english&count=100`
      );

      if (!inventoryRes.ok) {
        throw new Error('Failed to load CS inventory. Make sure the profile is public.');
      }

      const inventoryData = await inventoryRes.json();

      if (!inventoryData.descriptions || inventoryData.descriptions.length === 0) {
        throw new Error('No CS2 items found. Make sure the inventory is public.');
      }

      const items = inventoryData.descriptions
        .filter((item) => item.marketable === 1)
        .map((item) => ({
          id: item.classid,
          name: item.market_hash_name || item.name,
          icon: item.icon_url ? `${STEAM_CDN}/${item.icon_url}` : null,
          rarity: extractRarity(item.tags),
          type: extractType(item.tags),
          exterior: extractExterior(item.tags),
          tradable: item.tradable === 1,
        }));

      setInventory(items);

      const prices = {};
      for (const item of items.slice(0, 20)) {
        try {
          const priceRes = await fetch(
            `${STEAM_API_BASE}/ISteamEconomy/GetAssetPrices/v1/?key=${steamApiKey}&appid=730&language=en&format=json`
          );
          if (priceRes.ok) {
            const priceJson = await priceRes.json();
            if (priceJson.result?.assets) {
              for (const asset of priceJson.result.assets) {
                if (asset.prices?.USD) {
                  prices[asset.classid] = asset.prices.USD;
                }
              }
            }
          }
          break;
        } catch {
          // price fetch is best-effort
        }
      }
      setPriceData(prices);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [steamApiKey]);

  useEffect(() => {
    if (steamId) {
      fetchInventory(steamId);
    }
  }, [steamId, fetchInventory]);

  const handleSteamIdSubmit = (e) => {
    e.preventDefault();
    if (steamIdInput.trim()) {
      setSteamId(steamIdInput.trim());
    }
  };

  const handleUpgrade = () => {
    if (!selectedSkin || isUpgrading) return;

    setIsUpgrading(true);
    setUpgradeResult(null);

    setTimeout(() => {
      const roll = Math.random() * 100;
      const won = roll < multiplier.chance;

      const basePrice = priceData[selectedSkin.id] || Math.floor(Math.random() * 5000) + 100;
      const upgradedPrice = Math.round(basePrice * multiplier.value);

      setUpgradeResult({
        won,
        originalSkin: selectedSkin,
        originalPrice: basePrice,
        upgradedPrice: won ? upgradedPrice : 0,
        multiplier: multiplier.value,
        roll: roll.toFixed(2),
      });

      setIsUpgrading(false);
    }, 2500);
  };

  const resetUpgrade = () => {
    setUpgradeResult(null);
    setSelectedSkin(null);
  };

  const rarityColor = (rarity) => {
    const colors = {
      'Consumer Grade': '#b0c3d9',
      'Industrial Grade': '#5e98d9',
      'Mil-Spec': '#4b69ff',
      Restricted: '#8847ff',
      Classified: '#d32ce6',
      Covert: '#eb4b4b',
      Contraband: '#e4ae39',
    };
    return colors[rarity] || '#b0c3d9';
  };

  return (
    <div className="upgrader">
      <header className="upgrader-header">
        <div className="upgrader-header-left">
          <h1 className="upgrader-title">Skin Upgrader</h1>
          <p className="upgrader-subtitle">
            Upgrade your CS2 skins with Steam API integration
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
              <svg viewBox="0 0 24 24" width="48" height="48" fill="#1b2838">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3l-.5 3H13v6.95c5.05-.5 9-4.76 9-9.95 0-5.52-4.48-10-10-10z" />
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
            <p className="connect-hint">
              Your Steam API Key: {steamApiKey ? 'Connected' : 'Not configured'}
            </p>
          </div>
        </section>
      ) : (
        <>
          {error && (
            <div className="upgrader-error" role="alert">
              {error}
              <button onClick={() => fetchInventory(steamId)}>Retry</button>
            </div>
          )}

          <div className="upgrader-layout">
            <aside className="inventory-panel" aria-label="Inventory">
              <div className="panel-header">
                <h2>Your Inventory</h2>
                <span className="item-count">{inventory.length} items</span>
              </div>

              {loading ? (
                <div className="loading-state">
                  <div className="spinner" aria-label="Loading inventory" />
                  <p>Loading inventory from Steam...</p>
                </div>
              ) : (
                <div className="inventory-grid">
                  {inventory.map((item) => (
                    <button
                      key={item.id}
                      className={`inventory-item ${selectedSkin?.id === item.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedSkin(item);
                        setUpgradeResult(null);
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
                    </button>
                  ))}
                  {!loading && inventory.length === 0 && !error && (
                    <p className="empty-inventory">No marketable items found</p>
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
                    <p className="result-skin">{upgradeResult.originalSkin.name}</p>
                    {upgradeResult.won ? (
                      <p className="result-value">
                        {formatPrice(upgradeResult.originalPrice)} &rarr;{' '}
                        {formatPrice(upgradeResult.upgradedPrice)}
                      </p>
                    ) : (
                      <p className="result-value">Skin lost in upgrade attempt</p>
                    )}
                    <p className="result-roll">
                      Roll: {upgradeResult.roll} / {multiplier.chance}
                    </p>
                    <button className="try-again-btn" onClick={resetUpgrade}>
                      Try Again
                    </button>
                  </div>
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
                          {selectedSkin.exterior && <span className="skin-exterior">{selectedSkin.exterior}</span>}
                          {priceData[selectedSkin.id] && (
                            <span className="skin-price">
                              {formatPrice(priceData[selectedSkin.id])}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="no-skin-selected">
                          <p>Select a skin from your inventory</p>
                        </div>
                      )}

                      <div className="upgrade-arrow">
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="#0ea5e9">
                          <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
                        </svg>
                      </div>

                      <div className="upgrade-target">
                        <div className="target-glow" />
                        <span className="target-multiplier">{multiplier.label}</span>
                        <span className="target-chance">{multiplier.chance}% chance</span>
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
    </div>
  );
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
