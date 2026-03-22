import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Navigation, 
  Plus, 
  CheckCircle, 
  ChevronRight, 
  Search, 
  Clock, 
  TrendingUp,
  Map as MapIcon,
  List as ListIcon,
  X,
  ArrowRight
} from 'lucide-react';
import { 
  GoogleMap, 
  useJsApiLoader, 
  MarkerF, 
  DirectionsRenderer
} from '@react-google-maps/api';
import { 
  MapContainer as LeafletMapContainer, 
  TileLayer, 
  Marker as LeafletMarker, 
  Popup, 
  Polyline as LeafletPolyline,
  useMap
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet marker icons in React
import L from 'leaflet';

// Use CDN for default markers to avoid local path resolution issues in some environments
const iconRetinaUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png';
const iconUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png';
const shadowUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- OSRM Routing Function ---
const fetchOSRMRoute = async (points) => {
  if (points.length < 2) return [];
  
  const coordinates = points.map(p => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=polyline`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      // Leaflet-ready decoding (using simple decoding if needed, or Leaflet can handle polylines)
      // Actually, OSRM returns polyline by default. 
      // We'll use polyline decoding to get lat/lng pairs.
      return decodePolyline(data.routes[0].geometry);
    }
  } catch (error) {
    console.error("OSRM Route error:", error);
  }
  return [];
};

// Polyline decoding helper (Google/OSRM algorithm)
function decodePolyline(str, precision = 5) {
  let index = 0, lat = 0, lng = 0, coordinates = [], shift = 0, result = 0, byte = null, latchange, lngchange, factor = Math.pow(10, precision);
  while (index < str.length) {
    byte = null; shift = 0; result = 0;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    latchange = ((result & 1) ? ~(result >> 1) : (result >> 1)); lat += latchange;
    byte = null; shift = 0; result = 0;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lngchange = ((result & 1) ? ~(result >> 1) : (result >> 1)); lng += lngchange;
    coordinates.push([lat / factor, lng / factor]);
  }
  return coordinates;
}


// --- Google Maps Integration ---
const GOOGLE_MAPS_API_KEY = "VOTRE_CLE_API_GOOGLE_MAPS"; // Placeholder

const MapContainer = ({ stops, currentStep }) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY
  });

  const [directions, setDirections] = React.useState(null);

  useEffect(() => {
    if (isLoaded && stops.length > 1) {
      const directionsService = new window.google.maps.DirectionsService();
      
      const origin = stops[0].address;
      const destination = stops[stops.length - 1].address;
      const waypoints = stops.slice(1, -1).map(stop => ({
        location: stop.address,
        stopover: true
      }));

      directionsService.route(
        {
          origin,
          destination,
          waypoints,
          travelMode: window.google.maps.TravelMode.DRIVING,
          optimizeWaypoints: true
        },
        (result, status) => {
          if (status === window.google.maps.DirectionsStatus.OK) {
            setDirections(result);
          } else {
            console.error(`Directions request failed: ${status}`);
          }
        }
      );
    }
  }, [isLoaded, stops]);

  const center = { lat: 48.8566, lng: 2.3522 }; // Default Paris

  if (!isLoaded) return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>Chargement de la carte...</div>;

  if (GOOGLE_MAPS_API_KEY === "VOTRE_CLE_API_GOOGLE_MAPS") {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', padding: 20, textAlign: 'center' }}>
        <MapPin size={48} style={{ marginBottom: 12 }} />
        <p style={{ fontWeight: 700, marginBottom: 8 }}>Clé API manquante</p>
        <p style={{ fontSize: '0.85rem' }}>Veuillez ajouter votre clé API Google Maps dans le code pour voir la carte.</p>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={center}
      zoom={12}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
      }}
    >
      {directions && <DirectionsRenderer directions={directions} />}
      
      {!directions && stops.map((_, i) => (
        <React.Fragment key={i} />
      ))}
    </GoogleMap>
  );
};

// Helper component to recenter map and fit bounds
const ChangeView = ({ coords, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (coords && coords.length > 0) {
      if (coords.length === 1) {
        map.setView([coords[0].lat, coords[0].lng], zoom);
      } else {
        const bounds = L.latLngBounds(coords.map(c => [c.lat, c.lng]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [coords, zoom, map]);
  return null;
};

const MapView = ({ stops, currentStep, userLocation, onOptimize, geocodingStatus, isGeocoding }) => {
  if (GOOGLE_MAPS_API_KEY !== "VOTRE_CLE_API_GOOGLE_MAPS") {
    return <MapContainer stops={stops} currentStep={currentStep} userLocation={userLocation} />;
  }
  
  return (
    <LeafletMap 
      stops={stops} 
      userLocation={userLocation} 
      onOptimize={onOptimize} 
      geocodingStatus={geocodingStatus}
      isGeocoding={isGeocoding}
    />
  );
};

// --- Leaflet (OpenStreetMap) Alternative ---
const LeafletMap = ({ stops, userLocation, onOptimize, geocodingStatus, isGeocoding }) => {
  const [center, setCenter] = React.useState([48.8566, 2.3522]); 
  const [routePath, setRoutePath] = React.useState([]);
  const [isRouting, setIsRouting] = React.useState(false);

  const coords = stops
    .map((s, i) => ({ ...s, originalIndex: i }))
    .filter(s => s.lat && s.lng && !s.delivered);

  // Update route when stops change
  useEffect(() => {
    const updateRoute = async () => {
      if (coords.length > 0) {
        setIsRouting(true);
        const points = userLocation ? [{ lat: userLocation.lat, lng: userLocation.lng }, ...coords] : coords;
        const path = await fetchOSRMRoute(points);
        if (path && path.length > 0) {
          setRoutePath(path);
        } else {
          // Fallback to straight lines if OSRM fails
          setRoutePath(points.map(p => [p.lat, p.lng]));
        }
        setIsRouting(false);
      } else {
        setRoutePath([]);
      }
    };
    
    updateRoute();
  }, [stops, userLocation]);

  // Center the map on user location or first stop
  useEffect(() => {
    if (userLocation) {
      setCenter([userLocation.lat, userLocation.lng]);
    } else if (stops.length > 0 && stops[0].lat) {
      setCenter([stops[0].lat, stops[0].lng]);
    }
  }, [userLocation, stops.length > 0 && stops[0].lat]);

  const handleOptimizationClick = () => {
    if (userLocation && stops.every(s => s.lat && s.lng)) {
      const optimized = optimizeRoute(userLocation, stops);
      onOptimize(optimized);
    }
  };

    
  const canOptimize = userLocation && coords.length === stops.filter(s => !s.delivered).length && coords.length > 1;
  
  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <div style={{ 
        position: 'absolute', 
        top: 10, 
        right: 10, 
        zIndex: 1000, 
        background: 'white', 
        padding: '8px 12px', 
        borderRadius: 12, 
        fontSize: '0.75rem', 
        boxShadow: 'var(--shadow-md)', 
        display: 'flex', 
        flexDirection: 'column',
        gap: 6,
        maxWidth: '220px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
          {isGeocoding ? (
            <Clock size={14} className="animate-spin" />
          ) : (
            <CheckCircle size={14} color={geocodingStatus.found === stops.length ? "var(--success)" : "var(--warning)"} />
          )}
          <span>{geocodingStatus.found}/{stops.length} points trouvés</span>
        </div>
        
        {canOptimize && (
          <button 
            onClick={handleOptimizationClick}
            className="btn btn-primary" 
            style={{ padding: '6px 10px', fontSize: '0.7rem', borderRadius: 8, width: '100%' }}
          >
            <TrendingUp size={12} /> Optimiser le parcours
          </button>
        )}

        {isRouting && (
          <div style={{ color: 'var(--primary)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} className="animate-spin" /> Calcul de l'itinéraire route...
          </div>
        )}

        {geocodingStatus.failed.length > 0 && (
          <div style={{ color: 'var(--error)', fontSize: '0.7rem', marginTop: 2 }}>
            <div style={{ fontWeight: 700 }}>Échecs :</div>
            {geocodingStatus.failed.map((addr, i) => (
              <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>• {addr}</div>
            ))}
          </div>
        )}
      </div>

      <LeafletMapContainer 
        center={center} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <ChangeView coords={coords} zoom={13} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {userLocation && (
          <LeafletMarker position={[userLocation.lat, userLocation.lng]} icon={L.divIcon({
            className: 'user-marker',
            html: `<div style="background: var(--primary); width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px var(--primary)"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          })}>
            <Popup>Votre position actuelle</Popup>
          </LeafletMarker>
        )}

        {coords.map((coord, idx) => {
          const isNext = idx === 0;
          return (
            <LeafletMarker 
              key={coord.originalIndex} 
              position={[coord.lat, coord.lng]}
              icon={isNext ? L.divIcon({
                className: 'next-marker',
                html: `<div style="background: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid var(--primary); box-shadow: 0 4px 12px rgba(0,0,0,0.2)">
                        <div style="width: 12px; height: 12px; background: var(--primary); border-radius: 50%"></div>
                       </div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
              }) : DefaultIcon}
            >
              <Popup>
                <div style={{ padding: 4 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    {isNext ? 'Prochaine étape' : `Étape ${coord.originalIndex + 1}`}
                  </div>
                  <div>{coord.address}</div>
                </div>
              </Popup>
            </LeafletMarker>
          );
        })}
        
        {routePath.length > 0 && (
          <LeafletPolyline 
            positions={routePath} 
            color="#3b82f6" 
            weight={5} 
            opacity={0.8} 
          />
        )}
      </LeafletMapContainer>
    </div>
  );
};

// Helper: Distance calculation (Haversine)
const getDistance = (p1, p2) => {
  const R = 6371; // km
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Helper: Format duration (minutes to readable string)
const formatDuration = (totalMinutes) => {
  if (totalMinutes < 60) return `${Math.round(totalMinutes)} min`;
  
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = Math.round(totalMinutes % 60);
  
  if (days > 0) {
    return `${days} jour${days > 1 ? 's' : ''}${hours > 0 ? ` ${hours}h` : ''}`;
  }
  
  return `${hours}h${minutes > 0 ? ` ${minutes}min` : ''}`;
};

// Helper: Greedy Optimization (Nearest Neighbor)
const optimizeRoute = (startPos, stopsWithCoords) => {
  if (stopsWithCoords.length === 0) return [];
  
  const optimized = [];
  let currentPos = startPos;
  let remaining = [...stopsWithCoords];

  while (remaining.length > 0) {
    let closestIndex = 0;
    let minDistance = getDistance(currentPos, remaining[0]);

    for (let i = 1; i < remaining.length; i++) {
      const dist = getDistance(currentPos, remaining[i]);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    }

    const nextStop = remaining.splice(closestIndex, 1)[0];
    optimized.push(nextStop);
    currentPos = nextStop;
  }

  return optimized;
};

// --- Main Application Component ---
function App() {
  const [view, setView] = useState('home'); // home, import, tour, summary
  const [stops, setStops] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [activeTour, setActiveTour] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [geocodingStatus, setGeocodingStatus] = useState({ total: 0, found: 0, failed: [] });
  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('livrafast_active_tour');
    if (saved) {
      const data = JSON.parse(saved);
      setStops(data.stops);
      setCurrentStep(data.currentStep);
      setActiveTour(data.id);
      if (data.userLocation) setUserLocation(data.userLocation);
      setView('tour');
    }
  }, []);

  const saveTour = (newStops, step, location) => {
    const tourData = { 
      id: activeTour || Date.now(), 
      stops: newStops, 
      currentStep: step,
      userLocation: location
    };
    localStorage.setItem('livrafast_active_tour', JSON.stringify(tourData));
  };

  useEffect(() => {
    const controller = new AbortController();
    
    const geocodeStops = async () => {
      // Find stops that need geocoding
      const toGeocode = stops.map((s, i) => ({ ...s, originalIndex: i })).filter(s => !s.lat || !s.lng);
      
      if (toGeocode.length === 0 || view !== 'tour') {
        setIsGeocoding(false);
        return;
      }

      setIsGeocoding(true);
      setGeocodingStatus({ total: stops.length, found: stops.length - toGeocode.length, failed: [] });

      const updatedStops = [...stops];
      let foundSomething = false;

      for (const stop of toGeocode) {
        if (controller.signal.aborted) break;

        try {
          const searchAddress = stop.address.toLowerCase().includes('france') ? stop.address : `${stop.address}, France`;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddress)}&limit=1`,
            { signal: controller.signal, headers: { 'Accept': 'application/json', 'User-Agent': 'LivraFast/1.0' } }
          );
          
          const data = await response.json();
          if (data && data.length > 0) {
            updatedStops[stop.originalIndex] = {
              ...updatedStops[stop.originalIndex],
              lat: parseFloat(data[0].lat),
              lng: parseFloat(data[0].lon)
            };
            foundSomething = true;
            setGeocodingStatus(prev => ({ ...prev, found: prev.found + 1 }));
          } else {
            setGeocodingStatus(prev => ({ ...prev, failed: [...prev.failed, stop.address] }));
          }
        } catch (error) {
          if (error.name !== 'AbortError') {
            setGeocodingStatus(prev => ({ ...prev, failed: [...prev.failed, stop.address] }));
          }
        }

        // Delay to respect Nominatim policy
        if (toGeocode.indexOf(stop) < toGeocode.length - 1 && !controller.signal.aborted) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      if (foundSomething) {
        setStops(updatedStops);
        saveTour(updatedStops, currentStep, userLocation);
      }
      setIsGeocoding(false);
    };

    if (view === 'tour' && stops.length > 0) {
      geocodeStops();
    }

    return () => controller.abort();
  }, [view, stops.length, !!userLocation]); // Trigger on tour start or length change

  const handleStartNewTour = () => setView('import');

  const handleAddStops = (newStops, useLocation) => {
    const formatted = newStops.map(s => ({ ...s, delivered: false }));
    
    const finalizeTour = (location) => {
      setStops(formatted);
      setCurrentStep(0);
      setActiveTour(Date.now());
      setUserLocation(location);
      saveTour(formatted, 0, location);
      setView('tour');
    };

    if (useLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          finalizeTour(loc);
        },
        (error) => {
          console.error("Geolocation error:", error);
          finalizeTour(null);
        }
      );
    } else {
      finalizeTour(null);
    }
  };

  const handleUpdateOptimizedStops = (optimizedStops) => {
    setStops(optimizedStops);
    saveTour(optimizedStops, currentStep, userLocation);
  };

  const markAsDelivered = (index) => {
    const newStops = [...stops];
    newStops[index].delivered = true;
    setStops(newStops);
    
    let nextStep = currentStep;
    if (index === currentStep && currentStep < stops.length - 1) {
      nextStep = currentStep + 1;
      setCurrentStep(nextStep);
    }
    
    saveTour(newStops, nextStep, userLocation);
    
    if (newStops.every(s => s.delivered)) {
      setView('summary');
      localStorage.removeItem('livrafast_active_tour');
    }
  };

  const openInGPS = (address) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`);
  };

  return (
    <div className="livrafast-app">
      {view === 'home' && <HomeView onStart={handleStartNewTour} />}
      {view === 'import' && <ImportView onBack={() => setView('home')} onComplete={handleAddStops} />}
      {view === 'tour' && (
        <TourView 
          stops={stops} 
          currentStep={currentStep} 
          userLocation={userLocation}
          onMarkDelivered={markAsDelivered} 
          onOpenGPS={openInGPS}
          onUpdateOptimizedStops={handleUpdateOptimizedStops}
          geocodingStatus={geocodingStatus}
          isGeocoding={isGeocoding}
          onEnd={() => { localStorage.removeItem('livrafast_active_tour'); setView('home'); }}
        />
      )}
      {view === 'summary' && (
        <SummaryView 
          stops={stops} 
          userLocation={userLocation}
          onClose={() => { setStops([]); setView('home'); }} 
        />
      )}
    </div>
  );
}

// --- Views ---

function HomeView({ onStart }) {
  return (
    <div className="container animate-fade-in" style={{ textAlign: 'center', paddingTop: '15vh' }}>
      <div className="flex-center" style={{ marginBottom: 24 }}>
        <div style={{ background: 'var(--primary)', color: 'white', padding: 16, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)' }}>
          <Navigation size={42} strokeWidth={2.5} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: 0 }}>LivraFast</h1>
        <span style={{ background: 'var(--primary)', color: 'white', padding: '4px 10px', borderRadius: 8, fontSize: '0.9rem', fontWeight: 700 }}>v2</span>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: 48 }}>
        Planification intelligente d'itinéraires pour livreurs indépendants.
      </p>
      
      <button className="btn btn-primary" style={{ padding: '20px 48px', fontSize: '1.2rem', width: '100%' }} onClick={onStart}>
        <Plus size={24} /> Nouvelle tournée
      </button>

      <div style={{ marginTop: 64, textAlign: 'left' }}>
        <h3 style={{ marginBottom: 16, fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pourquoi utiliser LivraFast ?</h3>
        <div style={{ display: 'grid', gap: 16 }}>
          {[
            { icon: <TrendingUp size={20} />, title: "Optimisez vos trajets", desc: "Économisez du carburant et du temps." },
            { icon: <CheckCircle size={20} />, title: "Suivi simple", desc: "Marquez vos livraisons en un clic." },
            { icon: <MapPin size={20} />, title: "Intégration GPS", desc: "Lancez Waze ou Google Maps instantanément." }
          ].map((item, i) => (
            <div key={i} className="card" style={{ display: 'flex', gap: 16, alignItems: 'center', padding: 16 }}>
              <div style={{ color: 'var(--primary)' }}>{item.icon}</div>
              <div>
                <div style={{ fontWeight: 600 }}>{item.title}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ImportView({ onBack, onComplete }) {
  const [addressInput, setAddressInput] = useState('');
  const [useLocation, setUseLocation] = useState(true);
  
  const handleImport = () => {
    const lines = addressInput.split('\n').filter(l => l.trim().length > 0);
    if (lines.length > 0) {
      onComplete(lines.map(addr => ({ address: addr.trim() })), useLocation);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        onComplete(lines.map(addr => ({ address: addr.trim().replace(/^"(.*)"$/, '$1') })), useLocation);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="container animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <X size={24} />
        </button>
        <h2 style={{ fontSize: '1.5rem' }}>Importer des adresses</h2>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 12 }}>Saisie manuelle (une adresse par ligne)</label>
        <textarea 
          placeholder="123 rue de la Paix, Paris&#10;456 avenue des Champs, Lyon..."
          style={{ width: '100%', height: 180, padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid #ddd', fontFamily: 'inherit', fontSize: '0.95rem', resize: 'none', marginBottom: 16 }}
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
        />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '12px', background: 'var(--secondary)', borderRadius: 12 }}>
          <input 
            type="checkbox" 
            id="use-location" 
            checked={useLocation} 
            onChange={(e) => setUseLocation(e.target.checked)}
            style={{ width: 20, height: 20 }}
          />
          <label htmlFor="use-location" style={{ fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>
            Démarrer depuis ma position actuelle
          </label>
        </div>

        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleImport} disabled={!addressInput.trim()}>
          Générer la tournée <ChevronRight size={20} />
        </button>
      </div>

      <div style={{ textAlign: 'center', padding: '0 20px', position: 'relative', marginBottom: 24 }}>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: '#eee', zIndex: -1 }}></div>
        <span style={{ background: 'var(--background)', padding: '0 16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>OU</span>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: '32px 20px', border: '2px dashed #ddd', background: 'transparent' }}>
        <div style={{ color: 'var(--primary)', marginBottom: 12 }}><Plus size={32} /></div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Importer un fichier .csv</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>Liste d'adresses en format colonnes</div>
        <input type="file" accept=".csv,.txt" style={{ display: 'none' }} id="csv-upload" onChange={handleFileUpload} />
        <label htmlFor="csv-upload" className="btn btn-secondary" style={{ width: '100%' }}>
          Choisir un fichier
        </label>
      </div>
    </div>
  );
}

function TourView({ stops, currentStep, userLocation, onMarkDelivered, onOpenGPS, onUpdateOptimizedStops, geocodingStatus, isGeocoding, onEnd }) {
  const [activeTab, setActiveTab] = useState('list'); // list, map
  const remaining = stops.filter(s => !s.delivered).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'white' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: '1.2rem' }}>Ma Tournée</h2>
            {isGeocoding && <Clock size={14} className="animate-spin" style={{ color: 'var(--primary)' }} />}
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {remaining} étapes restantes 
            {geocodingStatus.found < stops.length && ` • Geocodage: ${geocodingStatus.found}/${stops.length}`}
          </p>
        </div>
        <button onClick={onEnd} style={{ padding: '8px 12px', border: '1px solid #eee', borderRadius: 8, background: 'none' }}>
          Abandonner
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '4px', background: '#f5f5f5', margin: '12px 20px', borderRadius: 12 }}>
        <button 
          onClick={() => setActiveTab('list')}
          style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: activeTab === 'list' ? 'white' : 'transparent', fontWeight: 600, boxShadow: activeTab === 'list' ? 'var(--shadow-sm)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <ListIcon size={18} /> Liste
        </button>
        <button 
          onClick={() => setActiveTab('map')}
          style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: activeTab === 'map' ? 'white' : 'transparent', fontWeight: 600, boxShadow: activeTab === 'map' ? 'var(--shadow-sm)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <MapIcon size={18} /> Carte
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 100px 20px' }}>
        {activeTab === 'map' ? (
          <div style={{ height: 'calc(100vh - 250px)', borderRadius: 20, overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
            <MapView 
              stops={stops} 
              currentStep={currentStep} 
              userLocation={userLocation} 
              onOptimize={onUpdateOptimizedStops}
              geocodingStatus={geocodingStatus}
              isGeocoding={isGeocoding}
            />
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {stops.map((stop, i) => (
              <div key={i} className={`card animate-fade-in`} style={{ 
                padding: 16, 
                display: 'flex', 
                gap: 16, 
                alignItems: 'center', 
                opacity: stop.delivered ? 0.6 : 1,
                border: i === currentStep ? '2px solid var(--primary)' : '1px solid #eee'
              }}>
                <div style={{ 
                  width: 32, height: 32, borderRadius: '50%', background: stop.delivered ? 'var(--success)' : (i === currentStep ? 'var(--primary)' : '#f0f0f0'),
                  color: stop.delivered || i === currentStep ? 'white' : '#666',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0
                }}>
                  {stop.delivered ? <CheckCircle size={18} /> : i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stop.address}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {stop.delivered ? 'Livré' : (i === currentStep ? 'Etape actuelle' : 'Prochainement')}
                  </div>
                </div>
                {!stop.delivered && (
                  <button onClick={() => openInGPS(stop.address)} style={{ color: 'var(--primary)', background: 'none', border: 'none', padding: 8 }}>
                    <Navigation size={24} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer CTA */}
      {!stops[currentStep]?.delivered && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: 20, background: 'linear-gradient(transparent, white 40%)', zIndex: 10 }}>
          <div className="card animate-fade-in" style={{ boxShadow: '0 -10px 40px rgba(0,0,0,0.1)', border: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ background: 'var(--secondary)', color: 'var(--primary)', padding: 8, borderRadius: 8 }}>
                <MapPin size={24} />
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Prochaine étape ({currentStep + 1}/{stops.length})</div>
                <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stops[currentStep].address}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => onOpenGPS(stops[currentStep].address)}>
                Ouvrir GPS
              </button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => onMarkDelivered(currentStep)}>
                <CheckCircle size={20} /> Livrée
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryView({ stops, userLocation, onClose }) {
  const [totalDistance, setTotalDistance] = useState(0);

  useEffect(() => {
    let dist = 0;
    const stopsWithCoords = stops.filter(s => s.lat && s.lng);
    
    if (stopsWithCoords.length > 0) {
      let currentPos = userLocation;
      
      // If no user location, start from the first stop
      if (!currentPos && stopsWithCoords.length > 1) {
        currentPos = stopsWithCoords[0];
        for (let i = 1; i < stopsWithCoords.length; i++) {
          dist += getDistance(currentPos, stopsWithCoords[i]);
          currentPos = stopsWithCoords[i];
        }
      } else if (currentPos) {
        for (let i = 0; i < stopsWithCoords.length; i++) {
          dist += getDistance(currentPos, stopsWithCoords[i]);
          currentPos = stopsWithCoords[i];
        }
      }
    }
    setTotalDistance(dist);
  }, [stops, userLocation]);

  const estimatedMinutes = Math.round(totalDistance * 3); // Approx 3 mins per km (20km/h avg in city)

  return (
    <div className="container animate-fade-in" style={{ textAlign: 'center', paddingTop: '10vh' }}>
      <div className="flex-center" style={{ marginBottom: 24 }}>
        <div style={{ background: 'var(--success)', color: 'white', padding: 16, borderRadius: '50%', boxShadow: '0 8px 32px rgba(0, 200, 83, 0.3)' }}>
          <CheckCircle size={48} />
        </div>
      </div>
      <h1 style={{ marginBottom: 8 }}>Tournée terminée !</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 40 }}>Excellent travail, toutes les étapes ont été validées.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 48 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ color: 'var(--primary)', marginBottom: 8 }}><ListIcon size={24} /></div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stops.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Livraisons</div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ color: 'var(--primary)', marginBottom: 8 }}><Clock size={24} /></div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>~{formatDuration(estimatedMinutes)}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Temps estimé</div>
        </div>
        <div className="card" style={{ gridColumn: 'span 2', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Distance totale</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{totalDistance.toFixed(1)} <span style={{ fontSize: '1rem', fontWeight: 500 }}>km</span></div>
          </div>
          <div style={{ background: 'var(--secondary)', color: 'var(--primary)', padding: '8px 16px', borderRadius: 20, fontWeight: 700 }}>
            +{Math.round(totalDistance * 1.2)}% d'efficacité
          </div>
        </div>
      </div>

      <button className="btn btn-primary" style={{ width: '100%' }} onClick={onClose}>
        Retour à l'accueil
      </button>
    </div>
  );
}

export default App;
