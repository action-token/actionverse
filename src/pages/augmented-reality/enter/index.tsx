"use client";

import type React from "react";

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
import { ARCoin } from "~/components/common/AR-Coin";
import { BASE_URL } from "~/lib/common";
import { useNearByPin } from "~/lib/state/augmented-reality/useNearbyPin";
import useWindowDimensions from "~/lib/state/augmented-reality/useWindowWidth";
import type { ConsumedLocation } from "~/types/game/location";
import { Button } from "~/components/shadcn/ui/button";
import { useRouter } from "next/router";

const ARPage = () => {
  const [selectedPin, setPin] = useState<ConsumedLocation>();
  const collectPinRes = useRef();
  const { data } = useNearByPin();
  const winDim = useWindowDimensions();
  const router = useRouter();
  const [infoBoxVisible, setInfoBoxVisible] = useState(false);
  const [infoBoxPosition, setInfoBoxPosition] = useState({ left: 0, top: 0 });
  const [infoText, setInfoText] = useState<ConsumedLocation>();
  const rendererRef = useRef();
  const previousIntersectedObject = useRef();

  const [showLoading, setShowLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCollectionAnimation, setShowCollectionAnimation] = useState(false);
  const [collectedPin, setCollectedPin] = useState<ConsumedLocation | null>(
    null,
  );

  const arCoinsRef = useRef<ARCoin[]>([]);
  const hoveredCoinRef = useRef<ARCoin | null>(null);

  // Function to add visual indicators for cardinal directions
  const addCardinalDirections = (
    locar: any,
    scene: THREE.Scene,
    distance = 20,
  ) => {
    // Create geometries for direction indicators
    const arrowGeometry = new THREE.ConeGeometry(2, 8, 8);

    // North - Red
    const northMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.5,
    });
    const northArrow = new THREE.Mesh(arrowGeometry, northMaterial);
    northArrow.position.set(0, 0, -distance); // North is -z
    scene.add(northArrow);

    // East - Green
    const eastMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      emissive: 0x00ff00,
      emissiveIntensity: 0.5,
    });
    const eastArrow = new THREE.Mesh(arrowGeometry, eastMaterial);
    eastArrow.position.set(distance, 0, 0); // East is +x
    eastArrow.rotation.set(0, Math.PI / 2, 0);
    scene.add(eastArrow);

    // South - Blue
    const southMaterial = new THREE.MeshStandardMaterial({
      color: 0x0000ff,
      emissive: 0x0000ff,
      emissiveIntensity: 0.5,
    });
    const southArrow = new THREE.Mesh(arrowGeometry, southMaterial);
    southArrow.position.set(0, 0, distance); // South is +z
    southArrow.rotation.set(0, Math.PI, 0);
    scene.add(southArrow);

    // West - Yellow
    const westMaterial = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 0.5,
    });
    const westArrow = new THREE.Mesh(arrowGeometry, westMaterial);
    westArrow.position.set(-distance, 0, 0); // West is -x
    westArrow.rotation.set(0, -Math.PI / 2, 0);
    scene.add(westArrow);
  };

  // Add a reference grid to help with orientation
  const addReferenceGrid = (scene: THREE.Scene) => {
    const gridHelper = new THREE.GridHelper(100, 10, 0x444444, 0x888888);
    scene.add(gridHelper);
  };

  // Distance calculation helper function
  const calculateDistance = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Store test coins globally so we can add/remove them
  const testCoinsRef = useRef<THREE.Mesh[]>([]);
  const locarRef = useRef<any>(null);
  const coinsRef = useRef<THREE.Mesh[]>([]); // Declare coins variable

  const simulateApiCall = async () => {
    if (!selectedPin) return;
    try {
      setShowLoading(true);
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

      // Set the collected pin and show collection animation
      setCollectedPin(selectedPin);
      setShowCollectionAnimation(true);

      // Hide the collection animation after 4 seconds
      setTimeout(() => {
        setShowCollectionAnimation(false);
        setShowSuccess(true);
        router.push("/augmented-reality/home"); // Redirect to collection page
        // Hide success after 2 more seconds
        setTimeout(() => {
          setShowSuccess(false);
          setCollectedPin(null);
        }, 2000);
      }, 4000);
    } catch (error) {
      console.error("Error consuming location", error);

      alert("Error consuming location");
    } finally {
      setShowLoading(false);
    }
  };

  useEffect(() => {
    const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.001, 1000)

    const renderer = new THREE.WebGLRenderer({ alpha: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(0x000000, 0) // Transparent background
    document.body.appendChild(renderer.domElement)

    // @ts-ignore
    rendererRef.current = renderer

    const scene = new THREE.Scene()

    // Add lighting to the scene so we can see the coins
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0) // Increase intensity from 0.6 to 1.0
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2) // Increase intensity from 0.8 to 1.2
    directionalLight.position.set(1, 1, 0.5)
    scene.add(directionalLight)

    // Add a second directional light from another angle
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1.0)
    directionalLight2.position.set(-1, 1, -0.5)
    scene.add(directionalLight2)

    const locar = new LocationBased(scene, camera)
    locarRef.current = locar // Store reference for toggle function
    const cam = new WebcamRenderer(renderer)
    const clickHandler = new ClickHandler(renderer)
    const deviceOrientationControls = new DeviceOrientationControls(camera)

    window.addEventListener("resize", () => {
      renderer.setSize(window.innerWidth, window.innerHeight)
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
    })

    let firstLocation = true

    // @ts-ignore
    locar.on("gpsupdate", (pos) => {
      if (firstLocation) {
        const { latitude, longitude } = pos.coords



        const coinsPositions = data.nearbyPins

        console.log("coinsPositions", coinsPositions)


        if (!coinsPositions) return

        // Process coins with distance filtering
        let nearbyCount = 0
        let totalDistance = 0
        let processedCoins = 0

        // Create AR coins for each location
        for (const coinData of coinsPositions) {
          // Calculate distance from current position to coin
          const distance = calculateDistance(latitude, longitude, coinData.lat, coinData.lng)
          totalDistance += distance
          processedCoins++


          // Only add coins within a reasonable distance (e.g., 500 meters)
          if (distance > 500) {
            continue
          }

          nearbyCount++

          // Create ARCoin instance
          const consumedLocation: ConsumedLocation & {
            distance: number;
          } = {
            ...coinData,
            modal_url: coinData.url ?? "",
            viewed: false,
            distance: distance,
          }

          const arCoin = new ARCoin(consumedLocation)
          const coinMesh = arCoin.getMesh()
          const billboardGroup = arCoin.getBillboardGroup()

          // Add to scene using locar for positioning
          locar.add(coinMesh, coinData.lng, coinData.lat)
          scene.add(billboardGroup)

          // Store references
          arCoinsRef.current.push(arCoin)
          coinsRef.current.push(coinMesh)


        }



        firstLocation = false
      }
    })

    locar.startGps()

    function collectPin() {
      console.log("claim the pin");
    }

    // @ts-ignore
    collectPinRes.current = collectPin;

    // Add raycaster for hover detection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseMove = (event: MouseEvent) => {
      // Calculate mouse position in normalized device coordinates
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      // Update the picking ray with the camera and mouse position
      raycaster.setFromCamera(mouse, camera);

      // Calculate objects intersecting the picking ray
      const intersects = raycaster.intersectObjects(coinsRef.current);

      // Handle hover
      if (intersects.length > 0 && intersects[0]) {
        const intersectedCoin = intersects[0].object;

        // Find the corresponding ARCoin
        const arCoin = arCoinsRef.current.find(
          (coin) => coin.getMesh() === intersectedCoin,
        );

        if (arCoin && hoveredCoinRef.current !== arCoin) {
          // Hide previous hover
          if (hoveredCoinRef.current) {
            hoveredCoinRef.current.hideCard();
          }

          // Show new hover
          arCoin.showCard(camera);
          hoveredCoinRef.current = arCoin;
        }
      } else {
        // No intersection, hide any visible card
        if (hoveredCoinRef.current) {
          hoveredCoinRef.current.hideCard();
          hoveredCoinRef.current = null;
        }
      }
    };

    // Add mouse move listener
    window.addEventListener("mousemove", onMouseMove);

    // Update the animation loop to include the coin animation and billboard updates
    renderer.setAnimationLoop(() => {
      cam.update();
      deviceOrientationControls.update();

      // Update AR coin billboards
      arCoinsRef.current.forEach((arCoin) => {
        arCoin.updateBillboard(camera);
      });

      renderer.render(scene, camera);

      const [intersect] = clickHandler.raycast(camera, scene);

      // Handle any clicked objects
      if (intersect) {
        const objectData = intersect.object.userData as ConsumedLocation;

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
      window.removeEventListener("mousemove", onMouseMove);

      // Dispose AR coins
      arCoinsRef.current.forEach((arCoin) => {
        arCoin.dispose();
      });
      arCoinsRef.current = [];

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

      {/* Debug Panel */}

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

            <div className="flex flex-1 items-center space-x-4 p-4">

              <div className="text-white">
                <p className="text-sm font-semibold text-yellow-400">
                  Remaining:{" "}
                </p>
                <p className="text-lg font-bold">{selectedPin.collection_limit_remaining}</p>
              </div>
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

      {/* Collection Animation */}
      {showCollectionAnimation && collectedPin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
          <div className="relative flex flex-col items-center">
            {/* Animated coin */}
            <div className="relative mb-8">
              <div className="animate-bounce">
                <div className="relative mx-auto h-32 w-32">
                  {/* Coin container with 3D effect */}
                  <div className="animate-spin-slow absolute inset-0 rotate-12 transform rounded-full bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600 shadow-2xl">
                    <div className="absolute inset-2 overflow-hidden rounded-full border-4 border-yellow-200">
                      <img
                        src={
                          collectedPin.brand_image_url ??
                          "/placeholder.svg?height=200&width=200"
                        }
                        alt={collectedPin.brand_name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src =
                            "/placeholder.svg?height=200&width=200&text=" +
                            encodeURIComponent(collectedPin.brand_name);
                        }}
                      />
                    </div>
                  </div>

                  {/* Sparkle effects */}
                  <div className="absolute -left-2 -top-2 h-4 w-4 animate-ping rounded-full bg-yellow-300"></div>
                  <div className="animation-delay-200 absolute -right-3 -top-1 h-3 w-3 animate-ping rounded-full bg-white"></div>
                  <div className="animation-delay-400 absolute -bottom-2 -left-3 h-2 w-2 animate-ping rounded-full bg-yellow-400"></div>
                  <div className="animation-delay-600 absolute -bottom-1 -right-2 h-3 w-3 animate-ping rounded-full bg-yellow-200"></div>

                  {/* Glow effect */}
                  <div className="absolute inset-0 scale-110 animate-pulse rounded-full bg-yellow-400 opacity-30"></div>
                </div>
              </div>
            </div>

            {/* Collection text */}
            <div className="space-y-4 text-center text-white">
              <div className="animate-bounce text-6xl">🎉</div>
              <h2 className="animate-pulse text-4xl font-bold text-yellow-400">
                Coin Collected!
              </h2>
              <div className="max-w-md rounded-lg bg-black bg-opacity-50 p-6">
                <h3 className="mb-2 text-2xl font-semibold text-white">
                  {collectedPin.brand_name}
                </h3>
                <p className="mb-2 text-lg text-yellow-300">
                  {collectedPin.title}
                </p>
                <p className="text-sm text-gray-300">
                  {collectedPin.description}
                </p>
                <div className="mt-4 flex items-center justify-center space-x-2">
                  <Coins className="h-5 w-5 text-yellow-400" />
                  <span className="font-semibold text-yellow-400">
                    +1 Coin Added to Collection
                  </span>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-8 h-2 w-64 rounded-full bg-gray-700">
              <div className="animate-progress-fill h-2 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600"></div>
            </div>
          </div>
        </div>
      )}

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
      {
        data.nearbyPins && data.nearbyPins.length === 0 ? (
          <div className="absolute z-50 bottom-0  flex items-center justify-center w-full transition-transform">

            <p className="text-sm font-bold  text-gray-700">
              No coins found nearby. Try moving around to discover more!
            </p>

          </div>
        ) : (
          <div className="absolute z-50 bottom-0  flex items-center justify-center w-full transition-transform">

            <p className="text-sm font-bold  text-gray-700">
              {data.nearbyPins?.length} coins found nearby
            </p>

          </div>
        )
      }

      {/* Success animation */}
      {showSuccess && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-green-500 bg-opacity-50"
          style={{ width: winDim.width }}
        >
          <div className="rounded-lg bg-white p-6 text-center">
            <div className="mb-4 text-6xl">✅</div>
            <p className="mb-2 text-2xl font-bold text-green-600">
              Collection Complete!
            </p>
            <p className="text-lg">
              {collectedPin?.brand_name} added to your collection
            </p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes progress-fill {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }

        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }

        .animate-progress-fill {
          animation: progress-fill 4s ease-out forwards;
        }

        .animation-delay-200 {
          animation-delay: 0.2s;
        }

        .animation-delay-400 {
          animation-delay: 0.4s;
        }

        .animation-delay-600 {
          animation-delay: 0.6s;
        }
      `}</style>
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
  const handleComplete = () => { };

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
