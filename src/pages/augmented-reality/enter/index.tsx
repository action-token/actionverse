/* eslint-disable */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
// @ts-ignore
import {
  ClickHandler,
  DeviceOrientationControls,
  LocationBased,
  WebcamRenderer,
} from "~/lib/augmented-reality/locationbased-ar";

import { ArrowLeft, Coins, ShoppingBasket } from "lucide-react";
import ArCard from "~/components/common/ar-card";
import { BASE_URL } from "~/lib/common";
import { useNearByPin } from "~/lib/state/augmented-reality/useNearbyPin";
import useWindowDimensions from "~/lib/state/augmented-reality/useWindowWidth";
import { ConsumedLocation } from "~/types/game/location";
import { Button } from "~/components/shadcn/ui/button";

const ARPage = () => {
  const [selectedPin, setPin] = useState<ConsumedLocation>();
  const collectPinRes = useRef();
  const { data } = useNearByPin();
  const winDim = useWindowDimensions();

  const [infoBoxVisible, setInfoBoxVisible] = useState(false);
  const [infoBoxPosition, setInfoBoxPosition] = useState({ left: 0, top: 0 });
  const [infoText, setInfoText] = useState<ConsumedLocation>();
  const rendererRef = useRef();
  const previousIntersectedObject = useRef();

  const [showLoading, setShowLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Debug state
  const [showDebug, setShowDebug] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [gpsPosition, setGpsPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [coinsCount, setCoinsCount] = useState(0);
  const [lastIntersect, setLastIntersect] = useState<string | null>(null);
  const [sceneCoinsCount, setSceneCoinsCount] = useState(0);
  const [cameraPosition, setCameraPosition] = useState<{ x: number; y: number; z: number } | null>(null);
  const [nearbyCoinsCount, setNearbyCoinsCount] = useState(0);
  const [averageDistance, setAverageDistance] = useState<number | null>(null);
  const [showTestCoins, setShowTestCoins] = useState(false);

  // Debug log function
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 9)]);
  };

  // Distance calculation helper function
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  // Store test coins globally so we can add/remove them
  const testCoinsRef = useRef<THREE.Mesh[]>([]);
  const locarRef = useRef<any>(null);

  // Function to add test coins
  const addTestCoins = (latitude: number, longitude: number, locar: any, coins: THREE.Mesh[]) => {
    if (testCoinsRef.current.length > 0) return; // Already added

    // Add main test coin
    const testCoinGeometry = new THREE.CylinderGeometry(2, 2, 0.3, 32);
    testCoinGeometry.rotateX(Math.PI / 2);
    
    const testCoinMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff0000,
      transparent: true,
      opacity: 0.8
    });
    
    const testCoin = new THREE.Mesh(testCoinGeometry, testCoinMaterial);
    testCoin.userData = { 
      brand_name: "Test Coin", 
      description: "This is a test coin to verify visibility",
      id: "test",
      lat: latitude,
      lng: longitude
    };
    
    // Add test coin 10 meters north of current position
    const testLat = latitude + 0.0001; // roughly 10 meters north
    locar.add(testCoin, longitude, testLat);
    coins.push(testCoin);
    testCoinsRef.current.push(testCoin);
    addDebugLog(`Added test coin at ${testLat.toFixed(6)}, ${longitude.toFixed(6)}`);

    // Add close test coins at different distances
    const closeTestPositions = [
      { lat: latitude + 0.00005, lng: longitude, distance: "5m North", color: 0x00ff00 }, // ~5m north (green)
      { lat: latitude, lng: longitude + 0.00005, distance: "5m East", color: 0x0000ff }, // ~5m east (blue)
      { lat: latitude - 0.00005, lng: longitude, distance: "5m South", color: 0xffff00 }, // ~5m south (yellow)
      { lat: latitude, lng: longitude - 0.00005, distance: "5m West", color: 0xff00ff }, // ~5m west (magenta)
    ];

    for (const testPos of closeTestPositions) {
      const closeTestGeometry = new THREE.CylinderGeometry(1, 1, 0.2, 16);
      closeTestGeometry.rotateX(Math.PI / 2);
      
      const closeTestMaterial = new THREE.MeshBasicMaterial({ 
        color: testPos.color,
        transparent: true,
        opacity: 0.9
      });
      
      const closeTestCoin = new THREE.Mesh(closeTestGeometry, closeTestMaterial);
      closeTestCoin.userData = { 
        brand_name: `Close Test ${testPos.distance}`, 
        description: `Test coin ${testPos.distance} from your position`,
        id: `close-test-${testPos.distance}`,
        lat: testPos.lat,
        lng: testPos.lng
      };
      
      locar.add(closeTestCoin, testPos.lng, testPos.lat);
      coins.push(closeTestCoin);
      testCoinsRef.current.push(closeTestCoin);
      addDebugLog(`Added close test coin ${testPos.distance}: ${testPos.lat.toFixed(6)}, ${testPos.lng.toFixed(6)}`);
    }
  };

  // Function to remove test coins
  const removeTestCoins = (locar: any, coins: THREE.Mesh[]) => {
    testCoinsRef.current.forEach(testCoin => {
      // Remove from the Three.js scene instead of using locar.remove
      if (locar.scene) {
        locar.scene.remove(testCoin);
      }
      
      // Remove from coins array
      const index = coins.indexOf(testCoin);
      if (index > -1) {
        coins.splice(index, 1);
      }
      
      // Dispose of geometry and material to free memory
      if (testCoin.geometry) {
        testCoin.geometry.dispose();
      }
      if (testCoin.material) {
        if (Array.isArray(testCoin.material)) {
          testCoin.material.forEach(material => material.dispose());
        } else {
          testCoin.material.dispose();
        }
      }
    });
    testCoinsRef.current = [];
    addDebugLog(`Removed all test coins`);
  };

  // Toggle test coins
  const toggleTestCoins = () => {
    if (!locarRef.current || !gpsPosition) return;
    
    const coins = (window as any).arCoins || [];
    
    if (showTestCoins) {
      removeTestCoins(locarRef.current, coins);
    } else {
      addTestCoins(gpsPosition.lat, gpsPosition.lng, locarRef.current, coins);
    }
    
    setSceneCoinsCount(coins.length);
    setShowTestCoins(!showTestCoins);
  };

  const simulateApiCall = async () => {
    if (!selectedPin) return;
    try {
      setShowLoading(true);
      addDebugLog(`Attempting to capture pin: ${selectedPin.brand_name}`);
      const response = await fetch(
        new URL("api/game/locations/consume", BASE_URL).toString(),
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ location_id: selectedPin.id.toString() }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to consume location");
      }
      addDebugLog(`Successfully captured pin: ${selectedPin.brand_name}`);
      setShowSuccess(true);
    } catch (error) {
      console.error("Error consuming location", error);
      addDebugLog(`Error capturing pin: ${error}`);
      alert("Error consuming location");
    } finally {
      setShowLoading(false);
    }
  };

  useEffect(() => {
    const camera = new THREE.PerspectiveCamera(
      80,
      window.innerWidth / window.innerHeight,
      0.001,
      1000,
    );

    const renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // Transparent background
    document.body.appendChild(renderer.domElement);

    // @ts-ignore
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    
    // Add lighting to the scene so we can see the coins
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 0.5);
    scene.add(directionalLight);
    
    const locar = new LocationBased(scene, camera);
    locarRef.current = locar; // Store reference for toggle function
    const cam = new WebcamRenderer(renderer);
    const clickHandler = new ClickHandler(renderer);
    const deviceOrientationControls = new DeviceOrientationControls(camera);

    window.addEventListener("resize", () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });

    let coins: THREE.Mesh[] = [];
    let firstLocation = true;

    // Make coins globally accessible for toggle function
    (window as any).arCoins = coins;

    // @ts-ignore
    locar.on("gpsupdate", (pos) => {
      if (firstLocation) {
        const { latitude, longitude } = pos.coords;
        
        setGpsPosition({ lat: latitude, lng: longitude });
        addDebugLog(`GPS location found: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);

        alert(`GPS location found! ${latitude}, ${longitude}`);

        // Test coins are now optional via debug panel toggle
        // They will only be added when user clicks "Toggle Test Coins" button

        // Generate random box positions around initial location
        // const boxPositions = generateRandomBoxPositions(latitude, longitude);
        const coinsPositions = data.nearbyPins;

        console.log("coinsPositions", coinsPositions);
        addDebugLog(`Nearby pins loaded: ${coinsPositions?.length || 0} coins`);
        setCoinsCount(coinsPositions?.length || 0);
        alert("Coins found: " + coinsPositions?.length);

        if (!coinsPositions) return;

        // Create and add boxes to the scene
        // Create coin geometry
        const radius = 5;
        const thickness = 0.2;
        const segments = 64;
        const coinGeometry = new THREE.CylinderGeometry(
          radius,
          radius,
          thickness,
          segments,
        );
        coinGeometry.rotateX(Math.PI / 2);

        const color = 0xff0000;
        const icon = "./assets/images/logo.png";

        // Process coins with distance filtering
        let nearbyCount = 0;
        let totalDistance = 0;
        let processedCoins = 0;

        for (const coin of coinsPositions) {
          // Calculate distance from current position to coin
          const distance = calculateDistance(latitude, longitude, coin.lat, coin.lng);
          totalDistance += distance;
          processedCoins++;
          
          addDebugLog(`Coin "${coin.brand_name}" is ${distance.toFixed(0)}m away`);
          
          // Only add coins within a reasonable distance (e.g., 500 meters)
          if (distance > 500) {
            addDebugLog(`Skipping distant coin: ${coin.brand_name} (${distance.toFixed(0)}m away)`);
            continue;
          }

          nearbyCount++;

          // Create a simpler coin first to test visibility
          const simpleCoinMaterial = new THREE.MeshBasicMaterial({ 
            color: distance < 50 ? 0x00ff00 : 0xffa500,  // Green if close (<50m), orange if far
            transparent: true,
            opacity: 0.9
          });
          
          const simpleCoin = new THREE.Mesh(coinGeometry, simpleCoinMaterial);
          simpleCoin.userData = { ...coin, distance: distance };
          locar.add(simpleCoin, coin.lng, coin.lat);
          coins.push(simpleCoin);
          setSceneCoinsCount(coins.length);
          addDebugLog(`Added coin: ${coin.brand_name} at ${coin.lat.toFixed(6)}, ${coin.lng.toFixed(6)} (${distance.toFixed(0)}m away)`);

          // Keep the original textured coin code but comment it out for now
          /*
          // Create textures for both sides
          const textureLoader = new THREE.TextureLoader();
          const headTexture = textureLoader.load(icon);
          const tailTexture = textureLoader.load(
            coin.brand_image_url ?? "https://picsum.photos/300/300",
          );

          // Create materials for the coin
          const headMaterial = new THREE.MeshStandardMaterial({
            map: headTexture,
            roughness: 0.3,
          });
          const tailMaterial = new THREE.MeshStandardMaterial({
            map: tailTexture,
            roughness: 0.3,
          });
          const edgeMaterial = new THREE.MeshStandardMaterial({
            color: 0xd4af37, // Gold color
            roughness: 0.3,
          });

          // Create coin materials array
          const materials = [
            edgeMaterial, // Edge
            headMaterial, // Top
            tailMaterial, // Bottom
          ];

          const coinObject = new THREE.Mesh(coinGeometry, materials);
          coinObject.userData = coin;
          locar.add(coinObject, coin.lng, coin.lat);
          coins.push(coinObject);
          addDebugLog(`Added coin: ${coin.brand_name} at ${coin.lat.toFixed(6)}, ${coin.lng.toFixed(6)}`);
          */
        }

        // Update debug stats
        setNearbyCoinsCount(nearbyCount);
        setAverageDistance(processedCoins > 0 ? totalDistance / processedCoins : null);
        
        addDebugLog(`Summary: ${nearbyCount}/${processedCoins} coins within 500m range`);
        firstLocation = false;
      }
    });

    locar.startGps();

    function collectPin() {
      console.log("claim the pin");
    }

    // @ts-ignore
    collectPinRes.current = collectPin;

    renderer.setAnimationLoop(() => {
      cam.update();
      deviceOrientationControls.update();
      renderer.render(scene, camera);

      // Update camera position for debugging
      setCameraPosition({
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
      });

      const [intersect] = clickHandler.raycast(camera, scene);

      // Handle any clicked objects
      if (intersect) {
        // if (previousIntersectedObject.current) {
        //   previousIntersectedObject.current.material.color.set(
        //     previousIntersectedObject.current.userData.color
        //   );
        // }

        const objectData = intersect.object.userData as ConsumedLocation;
        
        setLastIntersect(objectData.brand_name);
        addDebugLog(`Intersected with: ${objectData.brand_name}`);

        // Set the info box content and position
        setInfoText(objectData);
        setInfoBoxVisible(true);

        // Calculate screen position of the intersected object
        const vector = new THREE.Vector3();
        intersect.object.getWorldPosition(vector);
        vector.project(camera);

        const left = ((vector.x + 1) / 2) * window.innerWidth;
        const top = (-(vector.y - 1) / 2) * window.innerHeight;
        setInfoBoxPosition({ left, top });

        // Set color change on object
        // intersect.object.material.color.set(0xff0000);
        // @ts-ignore
        previousIntersectedObject.current = intersect.object;

        // Hide info box after 3 seconds
        setTimeout(() => setInfoBoxVisible(false), 3000);

        // Set pin to object's name
        setPin(objectData);
      }
    });

    return () => {
      // Clean up
      renderer.dispose();
      document.body.removeChild(renderer.domElement);
    };
  }, []);

  // return <ArLoading pin={pin} />;
  return (
    <>
      <Button
        className="absolute left-4 top-4 z-50 transition-transform"
        onClick={() => window.history.back()}
      >
        <ArrowLeft className="h-6 w-6" /> Back
      </Button>

      {/* Debug Toggle Button */}
      <Button
        className="absolute right-4 top-4 z-50 transition-transform"
        onClick={() => setShowDebug(!showDebug)}
        variant={showDebug ? "default" : "outline"}
      >
        Debug {showDebug ? "ON" : "OFF"}
      </Button>

      {/* Debug Panel */}
      {showDebug && (
        <div className="absolute left-4 top-16 z-40 w-80 max-h-96 overflow-y-auto bg-black bg-opacity-80 text-white p-4 rounded-lg text-xs font-mono">
          <div className="mb-4 border-b border-gray-600 pb-2">
            <h3 className="text-lg font-bold text-yellow-400">AR Debug Panel</h3>
          </div>
          
          <div className="space-y-3">
            <div>
              <span className="text-yellow-400">GPS Position:</span>
              <div className="text-green-400">
                {gpsPosition ? `${gpsPosition.lat.toFixed(6)}, ${gpsPosition.lng.toFixed(6)}` : "Not available"}
              </div>
            </div>
            
            <div>
              <span className="text-yellow-400">Coins Loaded:</span>
              <span className="text-green-400 ml-2">{coinsCount}</span>
            </div>
            
            <div>
              <span className="text-yellow-400">Coins in Scene:</span>
              <span className="text-green-400 ml-2">{sceneCoinsCount}</span>
            </div>
            
            <div>
              <span className="text-yellow-400">Nearby Coins (≤500m):</span>
              <span className="text-green-400 ml-2">{nearbyCoinsCount}</span>
            </div>
            
            <div>
              <span className="text-yellow-400">Average Distance:</span>
              <div className="text-green-400">{averageDistance ? `${averageDistance.toFixed(0)}m` : "Not available"}</div>
            </div>
            
            <div>
              <span className="text-yellow-400">Camera Position:</span>
              <div className="text-green-400 text-xs">
                {cameraPosition ? 
                  `x: ${cameraPosition.x.toFixed(2)}, y: ${cameraPosition.y.toFixed(2)}, z: ${cameraPosition.z.toFixed(2)}` 
                  : "Not available"
                }
              </div>
            </div>
            
            <div>
              <span className="text-yellow-400">Selected Pin:</span>
              <div className="text-green-400">{selectedPin?.brand_name || "None"}</div>
            </div>
            
            <div>
              <span className="text-yellow-400">Last Intersect:</span>
              <div className="text-green-400">{lastIntersect || "None"}</div>
            </div>
            
            <div>
              <span className="text-yellow-400">Window Size:</span>
              <div className="text-green-400">{winDim.width} x {winDim.height}</div>
            </div>
            
            <div>
              <span className="text-yellow-400">Info Box Visible:</span>
              <span className="text-green-400 ml-2">{infoBoxVisible ? "Yes" : "No"}</span>
            </div>
          </div>
          
          <div className="mt-4 border-t border-gray-600 pt-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-yellow-400">AR Testing:</span>
              <Button
                size="sm"
                variant={showTestCoins ? "default" : "outline"}
                onClick={toggleTestCoins}
                className="text-xs py-1 px-2 h-auto"
              >
                Test Coins {showTestCoins ? "ON" : "OFF"}
              </Button>
            </div>
            <div className="text-xs text-gray-400 mb-3">
              Toggle test coins to verify AR positioning is working correctly
            </div>
          </div>
          
          <div className="mt-4 border-t border-gray-600 pt-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-yellow-400">Debug Logs:</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDebugLogs([])}
                className="text-xs py-1 px-2 h-auto"
              >
                Clear
              </Button>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {debugLogs.length === 0 ? (
                <div className="text-gray-400">No logs yet...</div>
              ) : (
                debugLogs.map((log, index) => (
                  <div key={index} className="text-green-300 text-xs break-words">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {infoBoxVisible && (
        <ArCard
          brandName={infoText?.brand_name}
          description={infoText?.description}
          position={{
            left: winDim.width / 2 - 208 / 2,
            top: infoBoxPosition.top,
          }}
        />
      )}

      {selectedPin && (
        <div className="absolute bottom-0 left-0 right-0  w-full bg-gray-100">
          <div
            className="absolute bottom-0 left-0 right-0 flex items-stretch bg-gray-800 shadow-lg"
            style={{ width: winDim.width }}
          >
            <div className="flex flex-1 items-center space-x-4 p-4">
              <div className="relative">
                <ShoppingBasket className="h-12 w-12 text-yellow-500" />
                <div className="absolute bottom-1 right-1 rounded-full bg-yellow-400 p-1">
                  <Coins className="h-4 w-4 text-yellow-800" />
                </div>
              </div>
              <div className="text-white">
                <p className="text-sm font-semibold text-yellow-400">
                  {selectedPin.title}
                </p>
                <p className="text-lg font-bold">{selectedPin.brand_name}</p>
              </div>
            </div>

            <div
              className="my-2 w-px self-stretch bg-gray-700"
              aria-hidden="true"
            ></div>

            <div className="flex flex-1 items-center p-4">
              <p className="line-clamp-2 overflow-hidden text-sm leading-snug text-white">
                {selectedPin.description}
              </p>
            </div>

            <div
              className="my-2 w-px self-stretch bg-gray-700"
              aria-hidden="true"
            ></div>

            {!data.singleAR && (
              <div className="flex items-center p-4">
                <button
                  onClick={simulateApiCall}
                  className="rounded-lg bg-blue-500 px-6 py-2 font-semibold text-white transition-colors duration-200 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50"
                >
                  Capture
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <>
        {/* Loading overlay */}
        {showLoading && (
          <div
            className="absolute inset-0  flex items-center justify-center bg-black bg-opacity-50"
            style={{
              width: winDim.width,
            }}
          >
            <div className="rounded-lg bg-white p-6 text-center">
              <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-t-4 border-blue-500"></div>
              <p className="text-xl font-bold">Capturing the coin...</p>
            </div>
          </div>
        )}

        {/* Success animation */}
        {showSuccess && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-green-500 bg-opacity-50"
            style={{ width: winDim.width }}
          >
            <div className="rounded-lg bg-white p-6 text-center">
              <div className="mb-4 text-6xl">🎉</div>
              <p className="mb-2 text-2xl font-bold">Coin Captured!</p>
              <p className="text-lg">{selectedPin?.brand_name}</p>
            </div>
          </div>
        )}
      </>
    </>
  );
};

export default ARPage;

interface ProgressButtonProps {
  onComplete: () => void;
  children: React.ReactNode;
  className?: string;
  duration?: number;
}

export function ProgressButton({
  onComplete,
  children,
  className = "",
  duration = 2000,
}: ProgressButtonProps) {
  const [progress, setProgress] = useState(0);
  const [isPressed, setIsPressed] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPressed) {
      intervalRef.current = setInterval(() => {
        setProgress((prevProgress) => {
          if (prevProgress >= 100) {
            clearInterval(intervalRef.current!);
            return 100;
          }
          return prevProgress + 1;
        });
      }, duration / 100);

      timeoutRef.current = setTimeout(() => {
        if (isPressed) {
          onComplete();
        }
      }, duration);
    } else {
      if (progress < 100) {
        setProgress(0);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isPressed, duration, onComplete, progress]);

  const handlePressStart = () => {
    setIsPressed(true);
  };

  const handlePressEnd = () => {
    setIsPressed(false);
  };

  return (
    <button
      className={`relative overflow-hidden ${className}`}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
    >
      <div className="relative z-10">{children}</div>
      <div
        className="absolute inset-0 origin-left bg-green-400 transition-all duration-100"
        style={{
          transform: `scaleX(${progress / 100})`,
          opacity: 0.3,
        }}
      />
    </button>
  );
}

// Example usage
export function Example() {
  const handleComplete = () => {};

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100">
      <ProgressButton
        onComplete={handleComplete}
        className="rounded-lg bg-blue-500 px-6 py-3 text-white focus:outline-none"
      >
        Hold to Capture
      </ProgressButton>
    </div>
  );
}
