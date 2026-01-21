import { useState, useEffect } from 'react';
import { 
  getRestaurants, getOpportunities, getAdSetCategories,
  generateMetaTrackingLink, getTrackingLinks
} from '../api';
import type { Restaurant, Opportunity, AdSetCategory, TrackingLink } from '../types';
import type { GeneratedLink } from '../api';

export default function LinkGenerator() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [categories, setCategories] = useState<AdSetCategory[]>([]);
  const [recentLinks, setRecentLinks] = useState<TrackingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Form state
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<AdSetCategory | null>(null);
  const [destinationUrl, setDestinationUrl] = useState('');
  const [version, setVersion] = useState(1);
  const [saveLink, setSaveLink] = useState(false);

  // Generated link
  const [generatedLink, setGeneratedLink] = useState<GeneratedLink | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedRestaurant) {
      loadOpportunities(selectedRestaurant.rid);
      setDestinationUrl(selectedRestaurant.website || '');
    } else {
      setOpportunities([]);
      setSelectedOpportunity(null);
    }
  }, [selectedRestaurant]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rests, cats, links] = await Promise.all([
        getRestaurants(),
        getAdSetCategories(),
        getTrackingLinks(),
      ]);
      setRestaurants(rests);
      setCategories(cats);
      setRecentLinks(links.slice(0, 10));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadOpportunities = async (rid: number) => {
    try {
      const opps = await getOpportunities(rid);
      setOpportunities(opps.filter(o => o.status === 'active'));
    } catch (err) {
      console.error('Failed to load opportunities:', err);
    }
  };

  const handleGenerate = async () => {
    if (!selectedRestaurant || !selectedOpportunity || !selectedCategory || !destinationUrl) {
      setError('Please fill all required fields');
      return;
    }

    try {
      setGenerating(true);
      setError(null);
      
      const result = await generateMetaTrackingLink({
        rid: selectedRestaurant.rid,
        pk: selectedOpportunity.pk,
        destinationUrl,
        opportunitySlug: selectedOpportunity.slug,
        categoryCode: selectedCategory.code,
        version,
        save: saveLink,
      });

      setGeneratedLink(result);
      
      if (saveLink) {
        // Reload recent links
        const links = await getTrackingLinks();
        setRecentLinks(links.slice(0, 10));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate link');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink.finalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Failed to copy to clipboard');
    }
  };

  const getRestaurantName = (rid: number) => {
    return restaurants.find(r => r.rid === rid)?.name || `RID: ${rid}`;
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Link Generator</h1>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="link-generator-container">
        {/* Generator Form */}
        <div className="generator-form card">
          <h2>Generate Tracking Link</h2>
          
          <div className="form-group">
            <label>Restaurant *</label>
            <select
              value={selectedRestaurant?.id || ''}
              onChange={e => {
                const rest = restaurants.find(r => r.id === e.target.value);
                setSelectedRestaurant(rest || null);
                setSelectedOpportunity(null);
                setGeneratedLink(null);
              }}
            >
              <option value="">Select restaurant...</option>
              {restaurants.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} (rid={r.rid})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Opportunity (PK) *</label>
            <select
              value={selectedOpportunity?.id || ''}
              onChange={e => {
                const opp = opportunities.find(o => o.id === e.target.value);
                setSelectedOpportunity(opp || null);
                setGeneratedLink(null);
              }}
              disabled={!selectedRestaurant}
            >
              <option value="">Select opportunity...</option>
              {opportunities.map(o => (
                <option key={o.id} value={o.id}>
                  pk{o.pk} - {o.name} ({o.offer_type})
                </option>
              ))}
            </select>
            {selectedRestaurant && opportunities.length === 0 && (
              <small className="text-muted">No active opportunities. Create one first.</small>
            )}
          </div>

          <div className="form-group">
            <label>Category *</label>
            <select
              value={selectedCategory?.id || ''}
              onChange={e => {
                const cat = categories.find(c => c.id === e.target.value);
                setSelectedCategory(cat || null);
                setGeneratedLink(null);
              }}
            >
              <option value="">Select category...</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Destination URL *</label>
            <input
              type="url"
              value={destinationUrl}
              onChange={e => {
                setDestinationUrl(e.target.value);
                setGeneratedLink(null);
              }}
              placeholder="https://example.com/menu"
            />
          </div>

          <div className="form-group">
            <label>Ad Set Version</label>
            <input
              type="number"
              value={version}
              onChange={e => {
                setVersion(parseInt(e.target.value) || 1);
                setGeneratedLink(null);
              }}
              min={1}
            />
          </div>

          <div className="form-group checkbox">
            <label>
              <input
                type="checkbox"
                checked={saveLink}
                onChange={e => setSaveLink(e.target.checked)}
              />
              Save link to database
            </label>
          </div>

          <button 
            className="btn btn-primary btn-block"
            onClick={handleGenerate}
            disabled={generating || !selectedRestaurant || !selectedOpportunity || !selectedCategory || !destinationUrl}
          >
            {generating ? 'Generating...' : 'Generate Link'}
          </button>
        </div>

        {/* Generated Link Result */}
        <div className="generated-link card">
          <h2>Generated Link</h2>
          
          {generatedLink ? (
            <>
              <div className="link-preview">
                <code>{generatedLink.finalUrl}</code>
                <button 
                  className={`btn btn-sm ${copied ? 'btn-success' : ''}`}
                  onClick={copyToClipboard}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <h3>Components</h3>
              <table className="components-table">
                <tbody>
                  <tr>
                    <td><strong>r</strong></td>
                    <td>{generatedLink.components.r}</td>
                    <td className="text-muted">Restaurant ID</td>
                  </tr>
                  <tr>
                    <td><strong>c</strong></td>
                    <td><code>{generatedLink.components.c}</code></td>
                    <td className="text-muted">Campaign params (pi/pk/ps)</td>
                  </tr>
                  <tr>
                    <td><strong>utm_source</strong></td>
                    <td>{generatedLink.components.utm_source}</td>
                    <td className="text-muted">Source</td>
                  </tr>
                  <tr>
                    <td><strong>utm_medium</strong></td>
                    <td>{generatedLink.components.utm_medium}</td>
                    <td className="text-muted">Platform</td>
                  </tr>
                  <tr>
                    <td><strong>utm_campaign</strong></td>
                    <td>{generatedLink.components.utm_campaign}</td>
                    <td className="text-muted">Opportunity</td>
                  </tr>
                  <tr>
                    <td><strong>utm_content</strong></td>
                    <td>{generatedLink.components.utm_content}</td>
                    <td className="text-muted">Category + Version</td>
                  </tr>
                </tbody>
              </table>

              {generatedLink.saved && (
                <div className="saved-notice">Link saved to database</div>
              )}

              <div className="meta-notice">
                <strong>Note:</strong> The <code>{'{{ad.id}}'}</code> macro in the URL will be 
                automatically replaced by Meta with the actual ad ID when the ad is served.
              </div>
            </>
          ) : (
            <div className="no-link">
              <p>Fill in the form and click "Generate Link" to create a tracking URL.</p>
              <p className="text-muted">
                The generated link will include all required UTM parameters and custom 
                campaign parameters for attribution tracking.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Links */}
      {recentLinks.length > 0 && (
        <div className="recent-links">
          <h2>Recent Links</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Restaurant</th>
                <th>PK</th>
                <th>Campaign</th>
                <th>URL</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {recentLinks.map(link => (
                <tr key={link.id}>
                  <td>{getRestaurantName(link.rid)}</td>
                  <td><strong>pk{link.pk}</strong></td>
                  <td>{link.utm_campaign}</td>
                  <td>
                    <code className="truncate" title={link.final_url}>
                      {link.final_url.substring(0, 50)}...
                    </code>
                  </td>
                  <td>{new Date(link.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
