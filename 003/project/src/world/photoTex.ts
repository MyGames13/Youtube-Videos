import {createContext, useContext} from 'react';
import * as THREE from 'three';

// the photograph's live render target texture, shared by every photo card on screen
export const PhotoTexContext = createContext<THREE.Texture | null>(null);
export const usePhotoTex = () => useContext(PhotoTexContext);
