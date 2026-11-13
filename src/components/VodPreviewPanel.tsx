import { useCatalog } from '../context/CatalogContext';
import { isVodPreview, vodDemoItem } from '../player/vodPreview';

export function VodPreviewPanel() {
  const { startPlayback } = useCatalog();
  if (!isVodPreview()) return null;
  return <section className="m-notice" aria-label="Movie and series playback preview">
    <h2>Direct playback preview</h2>
    <p>To try MovieBox, search for Fight Club or Breaking Bad, press Play, then select MovieBox · MP4. CinePro and Icefy are unavailable.</p>
    <p>Try Big Buck Bunny in the MoroShow player. Film by Blender Foundation, CC BY 3.0.</p>
    <button className="m-secondary" onClick={() => void startPlayback(vodDemoItem, 0, 'demo-mp4')}>Test MP4</button>{' '}
    <button className="m-secondary" onClick={() => void startPlayback(vodDemoItem, 0, 'demo-hls')}>Test HLS</button>
  </section>;
}
