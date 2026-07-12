// Reconnaissance faciale côté navigateur (gratuit, via @vladmandic/face-api).
// Les modèles sont chargés à la demande depuis un CDN — rien de lourd dans le repo.

let faceapi: any = null;
let modelsLoaded = false;
const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";

export async function loadFaceModels() {
  if (!faceapi) faceapi = await import("@vladmandic/face-api");
  if (!modelsLoaded) {
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    modelsLoaded = true;
  }
  return faceapi;
}

async function descriptorFromUrl(url: string): Promise<Float32Array | null> {
  const fa = await loadFaceModels();
  const img = await fa.fetchImage(url);
  const det = await fa
    .detectSingleFace(img, new fa.TinyFaceDetectorOptions({ inputSize: 416 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return det ? det.descriptor : null;
}

// Compare une photo prise en direct (data URL) à la photo d'inscription (data URL).
// Renvoie matched=true si les visages concordent (distance <= 0.55).
export async function matchFaces(
  liveDataUrl: string,
  refUrl: string
): Promise<{ matched: boolean; distance: number; error?: string }> {
  try {
    const live = await descriptorFromUrl(liveDataUrl);
    if (!live) return { matched: false, distance: 1, error: "Aucun visage détecté sur la photo en direct. Placez bien votre visage face à la caméra." };
    const ref = await descriptorFromUrl(refUrl);
    if (!ref) return { matched: false, distance: 1, error: "Aucun visage détectable sur la photo d'inscription de l'employé." };
    const fa = await loadFaceModels();
    const distance = fa.euclideanDistance(live, ref);
    return { matched: distance <= 0.55, distance };
  } catch (e: any) {
    return { matched: false, distance: 1, error: e?.message || "Erreur lors de la reconnaissance faciale." };
  }
}
