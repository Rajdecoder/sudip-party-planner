// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { addDoc, collection, getDocs, getFirestore, limit, orderBy, query, serverTimestamp, startAfter } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDownloadURL, getStorage, ref, uploadBytesResumable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// --- YOUR FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCDuau7j4CyfotHfMr0svnDY8hp10F3f3M",
  authDomain: "sudipparty-24d31.firebaseapp.com",
  projectId: "sudipparty-24d31",
  storageBucket: "sudipparty-24d31.firebasestorage.app",
  messagingSenderId: "372149822854",
  appId: "1:372149822854:web:ca02d0536a604a31703807"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// --- 1. Star Rating Logic (UI) ---
const stars = document.querySelectorAll('#starRatingInput i');
const ratingValue = document.getElementById('selectedRating');

stars.forEach(star => {
    star.addEventListener('click', () => {
        const val = star.getAttribute('data-value');
        ratingValue.value = val; // Set hidden input value
        
        // Visual Update
        stars.forEach(s => {
            if(s.getAttribute('data-value') <= val) {
                s.style.color = "#ffc107"; // Gold
            } else {
                s.style.color = "#ccc"; // Gray
            }
        });
    });
});

// Set default visual to 5 stars
stars.forEach(s => s.style.color = "#ffc107");

// --- 2. Navigation Menu Logic ---
const burger = document.querySelector('.burger');
const nav = document.querySelector('.nav-links');
const navLinks = document.querySelectorAll('.nav-links li');

if(burger) {
    burger.addEventListener('click', () => {
        nav.classList.toggle('nav-active');
        burger.classList.toggle('toggle');
    });

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            nav.classList.remove('nav-active');
            burger.classList.remove('toggle');
        });
    });
}

// --- 3. Image Compression Logic ---
async function compressImage(file) {
    if (file.type.startsWith('video/')) return file;
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7);
            }
        }
    });
}

// --- 4. Review Submission Logic ---
const reviewForm = document.getElementById('reviewForm');
const submitBtn = document.getElementById('submitBtn');
const uploadStatus = document.getElementById('uploadStatus');
const progressBar = document.getElementById('progressBar');
const statusText = document.getElementById('statusText');

if(reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.innerText = "Processing...";

        const name = document.getElementById('reviewerName').value;
        const text = document.getElementById('reviewerText').value;
        const rating = parseInt(document.getElementById('selectedRating').value);
        const file = document.getElementById('reviewMedia').files[0];
        let downloadURL = null;
        let fileType = null;

        try {
            if (file) {
                uploadStatus.style.display = 'block';
                statusText.innerText = "Compressing & Uploading...";
                const compressedFile = await compressImage(file);
                fileType = file.type.startsWith('video/') ? 'video' : 'image';
                
                const storageRef = ref(storage, 'reviews/' + Date.now() + '-' + file.name);
                const uploadTask = uploadBytesResumable(storageRef, compressedFile);

                await new Promise((resolve, reject) => {
                    uploadTask.on('state_changed', 
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            progressBar.style.width = progress + '%';
                        }, 
                        (error) => reject(error), 
                        () => {
                            getDownloadURL(uploadTask.snapshot.ref).then((url) => {
                                downloadURL = url;
                                resolve();
                            });
                        }
                    );
                });
            }

            // Save to Database
            await addDoc(collection(db, "reviews"), {
                name: name,
                text: text,
                rating: rating,
                mediaURL: downloadURL,
                mediaType: fileType,
                createdAt: serverTimestamp()
            });

            alert("Review Submitted Successfully!"); 
            window.location.reload(); 

        } catch (error) {
            console.error("Error:", error);
            alert("Error: " + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = "Post Review";
        }
    });
}

// --- 5. Pagination & Display Logic ---
const reviewsContainer = document.getElementById('reviewsContainer');
const loadMoreBtn = document.getElementById('loadMoreBtn');
let lastVisible = null;
const BATCH_SIZE = 5; 

async function loadReviews() {
    if(!reviewsContainer) return;

    let q;
    
    // Query: Order by Rating (High to Low), then limit
    if (!lastVisible) {
        q = query(collection(db, "reviews"), orderBy("rating", "desc"), limit(BATCH_SIZE));
    } else {
        q = query(collection(db, "reviews"), orderBy("rating", "desc"), startAfter(lastVisible), limit(BATCH_SIZE));
    }

    try {
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty && !lastVisible) {
            reviewsContainer.innerHTML = "<p style='text-align:center;'>No reviews yet. Be the first!</p>";
            loadMoreBtn.style.display = 'none';
            return;
        }

        // Update cursor
        if (!querySnapshot.empty) {
            lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
        }

        querySnapshot.forEach((doc) => {
            const review = doc.data();
            createReviewCard(review);
        });

        // Hide "Load More" if fewer than 5 docs returned
        if (querySnapshot.docs.length < BATCH_SIZE) {
            loadMoreBtn.style.display = 'none';
        } else {
            loadMoreBtn.style.display = 'block';
        }

    } catch (error) {
        console.error("Error loading reviews:", error);
        
        // --- IMPORTANT: INDEX CHECK ---
        // If you see a link in the console error, click it to create the database index!
        if(error.message.includes("index")) {
            console.warn("⚠️ ACTION REQUIRED: Open browser console and click the Firebase Index creation link.");
        }
    }
}

function createReviewCard(review) {
    let mediaHTML = "";
    if (review.mediaURL) {
        if (review.mediaType === 'video') {
            mediaHTML = `<video controls src="${review.mediaURL}" style="width:100%; border-radius:10px; margin-top:10px; max-height:250px;"></video>`;
        } else {
            mediaHTML = `<img src="${review.mediaURL}" alt="Review Image" style="width:100%; border-radius:10px; margin-top:10px; max-height:250px; object-fit:cover;">`;
        }
    }

    // Generate Stars HTML
    let starsHTML = '';
    for(let i=1; i<=5; i++) {
        if(i <= review.rating) {
            starsHTML += '<i class="fas fa-star" style="color:#f1c40f;"></i>';
        } else {
            starsHTML += '<i class="fas fa-star" style="color:#ccc;"></i>';
        }
    }

    const card = document.createElement("div");
    card.className = "review-card";
    card.innerHTML = `
        <div class="review-header">
            <div style="width:40px; height:40px; background:#ff4757; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; margin-right:10px;">
                ${review.name.charAt(0).toUpperCase()}
            </div>
            <div>
                <h4 style="margin:0;">${review.name}</h4>
                <div class="stars">${starsHTML}</div>
            </div>
        </div>
        <p class="review-text">"${review.text}"</p>
        ${mediaHTML}
    `;
    reviewsContainer.appendChild(card);
}

// Initial Load
if(loadMoreBtn) {
    loadMoreBtn.addEventListener('click', loadReviews);
}
// Trigger first load
loadReviews();