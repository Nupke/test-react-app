import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UpgraderPage from './UpgraderPage';

const mockInventory = {
  descriptions: [
    {
      classid: '1',
      instanceid: 'a1',
      market_hash_name: 'AK-47 | Redline (Field-Tested)',
      name: 'AK-47 | Redline',
      icon_url: 'abc',
      marketable: 1,
      tradable: 1,
      tags: [
        { category: 'Rarity', localized_tag_name: 'Classified' },
        { category: 'Exterior', localized_tag_name: 'Field-Tested' },
        { category: 'Type', localized_tag_name: 'Rifle' },
      ],
    },
    {
      classid: '2',
      instanceid: 'a2',
      market_hash_name: 'P250 | Sand Dune',
      name: 'P250',
      icon_url: 'xyz',
      marketable: 1,
      tradable: 1,
      tags: [{ category: 'Rarity', localized_tag_name: 'Consumer Grade' }],
    },
  ],
};

const mockMarketSearch = {
  results: [
    {
      hash_name: 'AWP | Dragon Lore (Factory New)',
      name: 'AWP | Dragon Lore',
      sell_price_text: '$10,000.00',
      sell_listings: 3,
      asset_description: {
        icon_url: 'dragon',
        tags: [
          { category: 'Rarity', localized_tag_name: 'Covert' },
          { category: 'Exterior', localized_tag_name: 'Factory New' },
        ],
      },
    },
  ],
};

describe('UpgraderPage', () => {
  beforeEach(() => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/inventory/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockInventory) });
      }
      if (url.includes('/market/search/render/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockMarketSearch) });
      }
      if (url.includes('/market/priceoverview/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ lowest_price: '$5.00', median_price: '$5.10' }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders connect screen when no steam id', () => {
    render(<UpgraderPage user="test@example.com" onBack={() => {}} steamApiKey="" />);
    expect(screen.getByText(/Connect Your Steam Account/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter Steam ID/i)).toBeInTheDocument();
  });

  it('loads inventory after submitting steam id', async () => {
    render(<UpgraderPage user="test@example.com" onBack={() => {}} steamApiKey="" />);
    fireEvent.change(screen.getByPlaceholderText(/Enter Steam ID/i), {
      target: { value: '76561198012345678' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Load Inventory/i }));

    await waitFor(() => {
      expect(screen.getByText(/AK-47 \| Redline/)).toBeInTheDocument();
    });
  });

  it('shows mode toggle with Classic and Target options', async () => {
    render(<UpgraderPage user="test@example.com" onBack={() => {}} steamApiKey="" />);
    fireEvent.change(screen.getByPlaceholderText(/Enter Steam ID/i), {
      target: { value: '76561198012345678' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Load Inventory/i }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Classic Multiplier/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Target Skin/i })).toBeInTheDocument();
    });
  });

  it('switches to target mode and multi-selects inventory items', async () => {
    render(<UpgraderPage user="test@example.com" onBack={() => {}} steamApiKey="" />);
    fireEvent.change(screen.getByPlaceholderText(/Enter Steam ID/i), {
      target: { value: '76561198012345678' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Load Inventory/i }));

    await waitFor(() => screen.getByText(/AK-47 \| Redline/));

    fireEvent.click(screen.getByRole('tab', { name: /Target Skin/i }));

    await waitFor(() => {
      expect(screen.getByText(/Selected Items \(0\)/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/AK-47 \| Redline/).closest('button'));

    await waitFor(() => {
      expect(screen.getByText(/Selected Items \(1\)/)).toBeInTheDocument();
    });
  });

  it('searches steam market for target skin and shows results', async () => {
    render(<UpgraderPage user="test@example.com" onBack={() => {}} steamApiKey="" />);
    fireEvent.change(screen.getByPlaceholderText(/Enter Steam ID/i), {
      target: { value: '76561198012345678' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Load Inventory/i }));

    await waitFor(() => screen.getByText(/AK-47 \| Redline/));
    fireEvent.click(screen.getByRole('tab', { name: /Target Skin/i }));

    fireEvent.change(screen.getByPlaceholderText(/Search market/i), {
      target: { value: 'Dragon' },
    });

    await waitFor(
      () => {
        expect(screen.getByText(/AWP \| Dragon Lore/)).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('disables upgrade button when no target skin selected', async () => {
    render(<UpgraderPage user="test@example.com" onBack={() => {}} steamApiKey="" />);
    fireEvent.change(screen.getByPlaceholderText(/Enter Steam ID/i), {
      target: { value: '76561198012345678' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Load Inventory/i }));

    await waitFor(() => screen.getByText(/AK-47 \| Redline/));
    fireEvent.click(screen.getByRole('tab', { name: /Target Skin/i }));

    const upgradeBtn = await screen.findByRole('button', { name: /UPGRADE/ });
    expect(upgradeBtn).toBeDisabled();
  });

  it('calls onBack when back button clicked', () => {
    const onBack = vi.fn();
    render(<UpgraderPage user="test@example.com" onBack={onBack} steamApiKey="" />);
    fireEvent.click(screen.getByRole('button', { name: /^Back$/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
