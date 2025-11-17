import { Marker as LeafletMarker, Popup } from "react-leaflet";
import L from "leaflet";

const customIcon = L.icon({
  iconUrl: "/marker-icon.png", // put your custom marker here
  iconSize: [35, 45], // adjust size
  iconAnchor: [17, 45], // where the point touches the map
  popupAnchor: [0, -45], // where popup opens
});

export default function Marker({ position, children }: any) {
  return (
    <LeafletMarker position={position} icon={customIcon}>
      {children && <Popup>{children}</Popup>}
    </LeafletMarker>
  );
}
