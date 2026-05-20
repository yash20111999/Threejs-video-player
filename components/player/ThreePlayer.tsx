"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { usePlaybackStore } from "@/store/usePlaybackStore";
import { usePlayerConfigStore } from "@/store/usePlayerConfigStore";

interface ThreePlayerProps {
  videoUrl: string;
  backgroundUrl: string;
  /** Optional: how wide the video sits within the scene at 0 padding (0–1). */
  baseFill?: number;
}

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Rounded-rect SDF computed in pixel space so corners stay circular
// regardless of the video's aspect ratio. Edges are anti-aliased.
const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uSize;     // mesh size in px
  uniform float uRadius;  // corner radius in px
  varying vec2 vUv;

  void main() {
    vec2 halfSize = uSize * 0.5;
    vec2 p = (vUv - 0.5) * uSize;
    float r = clamp(uRadius, 0.0, min(halfSize.x, halfSize.y));
    vec2 q = abs(p) - (halfSize - vec2(r));
    float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;

    float aa = fwidth(dist);
    float alpha = 1.0 - smoothstep(-aa, aa, dist);
    if (alpha <= 0.001) discard;

    vec4 color = texture2D(uMap, vUv);
    gl_FragColor = vec4(color.rgb, color.a * alpha);
  }
`;

export default function ThreePlayer({
  videoUrl,
  backgroundUrl,
  baseFill = 0.82,
}: ThreePlayerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const setVideoEl = usePlaybackStore((s) => s.setVideoEl);
  const setDuration = usePlaybackStore((s) => s.setDuration);
  const setIsPlaying = usePlaybackStore((s) => s.setIsPlaying);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let W = mount.clientWidth || 1;
    let H = mount.clientHeight || 1;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(
      -W / 2,
      W / 2,
      H / 2,
      -H / 2,
      0.1,
      100
    );
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    mount.appendChild(renderer.domElement);

    // --- Background plane (cover-fit, no distortion) ---
    const bgTexture = new THREE.TextureLoader().load(backgroundUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      bgImageAspect = tex.image.width / tex.image.height;
      layout();
    });
    let bgImageAspect = 16 / 9;
    const bgMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: bgTexture })
    );
    bgMesh.position.z = 0;
    scene.add(bgMesh);

    // --- Video element (offscreen, drives a VideoTexture) ---
    const video = document.createElement("video");
    video.src = videoUrl;
    video.crossOrigin = "anonymous";
    video.loop = false;
    video.muted = false;
    video.playsInline = true;
    video.preload = "metadata";

    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.colorSpace = THREE.SRGBColorSpace;

    let videoAspect = 16 / 9;

    const videoMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: videoTexture },
          uSize: { value: new THREE.Vector2(1, 1) },
          uRadius: { value: 0 },
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
      })
    );
    videoMesh.position.z = 1;
    scene.add(videoMesh);

    // Register the video element with the playback store.
    setVideoEl(video);
    const onLoadedMeta = () => {
      if (video.videoWidth && video.videoHeight) {
        videoAspect = video.videoWidth / video.videoHeight;
      }
      setDuration(video.duration || 0);
      layout();
    };
    const onEnded = () => setIsPlaying(false);
    video.addEventListener("loadedmetadata", onLoadedMeta);
    video.addEventListener("ended", onEnded);

    // --- Layout: recompute mesh sizes from canvas + padding ---
    function layout() {
      const canvasAspect = W / H;

      // Background "cover".
      let bw: number, bh: number;
      if (bgImageAspect > canvasAspect) {
        bh = H;
        bw = H * bgImageAspect;
      } else {
        bw = W;
        bh = W / bgImageAspect;
      }
      bgMesh.scale.set(bw, bh, 1);

      // Video "contain" inside the padded box.
      const pad = usePlayerConfigStore.getState().padding;
      const boxW = Math.max(1, W * baseFill - pad * 2);
      const boxH = Math.max(1, H * baseFill - pad * 2);
      const boxAspect = boxW / boxH;

      let vw: number, vh: number;
      if (boxAspect > videoAspect) {
        vh = boxH;
        vw = boxH * videoAspect;
      } else {
        vw = boxW;
        vh = boxW / videoAspect;
      }
      videoMesh.scale.set(vw, vh, 1);
      (videoMesh.material as THREE.ShaderMaterial).uniforms.uSize.value.set(
        vw,
        vh
      );
    }

    layout();

    // --- Render loop: reads config store WITHOUT subscribing (no re-render) ---
    let rafId = 0;
    let lastPadding = -1;
    const animate = () => {
      const { padding, borderRadius } = usePlayerConfigStore.getState();
      if (padding !== lastPadding) {
        lastPadding = padding;
        layout();
      }
      (videoMesh.material as THREE.ShaderMaterial).uniforms.uRadius.value =
        borderRadius;

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);

    // --- Resize ---
    const ro = new ResizeObserver(() => {
      W = mount.clientWidth || 1;
      H = mount.clientHeight || 1;
      renderer.setSize(W, H);
      camera.left = -W / 2;
      camera.right = W / 2;
      camera.top = H / 2;
      camera.bottom = -H / 2;
      camera.updateProjectionMatrix();
      layout();
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      video.removeEventListener("loadedmetadata", onLoadedMeta);
      video.removeEventListener("ended", onEnded);
      video.pause();
      video.removeAttribute("src");
      video.load();
      setVideoEl(null);
      videoTexture.dispose();
      bgTexture.dispose();
      (bgMesh.material as THREE.Material).dispose();
      (videoMesh.material as THREE.Material).dispose();
      bgMesh.geometry.dispose();
      videoMesh.geometry.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [videoUrl, backgroundUrl, baseFill, setVideoEl, setDuration, setIsPlaying]);

  return <div ref={mountRef} className="h-full w-full" />;
}
