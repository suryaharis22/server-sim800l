// src/lib/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, get, child } from "firebase/database";

const firebaseConfig = {
    apiKey: "AIzaSyD5jC7SdjRlVM2OFdC33SygOZ7y3y5_Pd0",
    authDomain: "sim800lv2-311fe.firebaseapp.com",
    databaseURL: "https://sim800lv2-311fe-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "sim800lv2-311fe",
    storageBucket: "sim800lv2-311fe.firebasestorage.app",
    messagingSenderId: "120296982805",
    appId: "1:120296982805:web:c31fc74533b35353d9c11c",
    measurementId: "G-7YH6ZWTDN2"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export { ref, push, get, child };
