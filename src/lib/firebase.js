// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
	apiKey: 'AIzaSyAhA99NAPKqoi_RK06gudNjPlc2n2ZN6Uw',
	authDomain: 'pharmacy-76298.firebaseapp.com',
	projectId: 'pharmacy-76298',
	storageBucket: 'pharmacy-76298.firebasestorage.app',
	messagingSenderId: '256348543731',
	appId: '1:256348543731:web:584abf146fd98e1c057586'
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
