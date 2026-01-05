// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, startAfter, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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

if(stars.length > 0) {
    stars.forEach(star => {
        star.addEventListener('click', () => {
            const val = star.getAttribute('data-value');
            if(ratingValue) ratingValue.value = val;
            
            stars.forEach(s => {
                s.style.color = (s.getAttribute('data-value') <= val) ? "#ffc107" : "#ccc";
            });
        });
    });
    // Set default visual to 5 stars
    stars.forEach(s => s.style.color = "#ffc107");
}

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

// --- 4. PREVIEW LOGIC ---
const fileInput = document.getElementById('reviewMedia');
const previewContainer = document.getElementById('previewContainer');
const fileNameDisplay = document.getElementById('fileName');
const imagePreview = document.getElementById('imagePreview');
const videoPreview = document.getElementById('videoPreview');
const uploadBtnText = document.getElementById('uploadBtnText');

if(fileInput) {
    fileInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            if(previewContainer) previewContainer.style.display = 'block';
            if(fileNameDisplay) fileNameDisplay.textContent = "Selected: " + file.name;
            if(uploadBtnText) uploadBtnText.textContent = "Change File";
            
            if(imagePreview) {
                imagePreview.style.display = 'none';
                imagePreview.src = "";
            }
            if(videoPreview) {
                videoPreview.style.display = 'none';
                videoPreview.src = "";
            }

            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    if(imagePreview) {
                        imagePreview.src = e.target.result;
                        imagePreview.style.display = 'inline-block';
                    }
                }
                reader.readAsDataURL(file);
            } else if (file.type.startsWith('video/')) {
                if(videoPreview) {
                    videoPreview.src = URL.createObjectURL(file);
                    videoPreview.style.display = 'block';
                }
            }
        } else {
            if(previewContainer) previewContainer.style.display = 'none';
        }
    });
}

// --- 5. Review Submission Logic ---
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
        const file = fileInput.files[0];
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

// --- 6. Load Reviews (With Pagination) ---
const reviewsContainer = document.getElementById('reviewsContainer');
const loadMoreBtn = document.getElementById('loadMoreBtn');
let lastReviewVisible = null;
const REVIEW_BATCH_SIZE = 5; 

async function loadReviews() {
    if(!reviewsContainer) return;

    let q;
    if (!lastReviewVisible) {
        q = query(collection(db, "reviews"), orderBy("createdAt", "desc"), limit(REVIEW_BATCH_SIZE));
    } else {
        q = query(collection(db, "reviews"), orderBy("createdAt", "desc"), startAfter(lastReviewVisible), limit(REVIEW_BATCH_SIZE));
    }

    try {
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty && !lastReviewVisible) {
            reviewsContainer.innerHTML = "<p style='text-align:center;'>No reviews yet. Be the first!</p>";
            if(loadMoreBtn) loadMoreBtn.style.display = 'none';
            return;
        }

        if (!querySnapshot.empty) {
            lastReviewVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // Generate Stars HTML
            let stars = "";
            for(let i=1; i<=5; i++) stars += (i<=data.rating) ? '<i class="fas fa-star" style="color:#f1c40f"></i>' : '<i class="fas fa-star" style="color:#ccc"></i>';

            // Generate Media HTML
            let media = "";
            if(data.mediaURL) {
                const content = (data.mediaType === 'video') 
                    ? `<video controls src="${data.mediaURL}"></video>` 
                    : `<img src="${data.mediaURL}" alt="User Review">`;
                media = `<div class="media-frame">${content}</div>`;
            }

            const div = document.createElement("div");
            div.className = "review-card";
            div.innerHTML = `
                <div class="review-header">
                    <div style="width:40px; height:40px; background:#ff4757; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; margin-right:10px;">
                        ${data.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h4 style="margin:0;">${data.name}</h4>
                        <div class="stars">${stars}</div>
                    </div>
                </div>
                <p class="review-text">"${data.text}"</p>
                ${media}
            `;
            reviewsContainer.appendChild(div);
        });

        if(loadMoreBtn) {
            loadMoreBtn.style.display = (querySnapshot.docs.length < REVIEW_BATCH_SIZE) ? 'none' : 'block';
        }

    } catch (error) {
        console.error("Error loading reviews:", error);
    }
}

// Initial Review Load
if(loadMoreBtn) {
    loadMoreBtn.addEventListener('click', loadReviews);
}
loadReviews();


// --- 7. LOAD DYNAMIC GALLERY (UPDATED with Pagination) ---
const galleryContainer = document.getElementById('dynamicGallery');
const loadMoreGalleryBtn = document.getElementById('loadMoreGalleryBtn');
let lastGalleryVisible = null;
const GALLERY_BATCH_SIZE = 10; // Show 10 images at a time

async function loadUserGallery() {
    if (!galleryContainer) return;

    let q;
    if (!lastGalleryVisible) {
        // First Load: Get first 10
        q = query(collection(db, "gallery"), orderBy("createdAt", "desc"), limit(GALLERY_BATCH_SIZE));
    } else {
        // Next Loads: Get 10 AFTER the last one we saw
        q = query(collection(db, "gallery"), orderBy("createdAt", "desc"), startAfter(lastGalleryVisible), limit(GALLERY_BATCH_SIZE));
    }

    try {
        const snapshot = await getDocs(q);

        // If it's the very first load and we found nothing
        if (snapshot.empty && !lastGalleryVisible) {
            galleryContainer.innerHTML = "<p style='text-align:center; width:100%;'>No photos added yet.</p>";
            if(loadMoreGalleryBtn) loadMoreGalleryBtn.style.display = 'none';
            return;
        }

        // If we found data, remove the "Loading..." text if it's there
        if (!lastGalleryVisible && galleryContainer.querySelector('p')) {
             galleryContainer.innerHTML = "";
        }

        // Update the cursor to the last document
        if (!snapshot.empty) {
            lastGalleryVisible = snapshot.docs[snapshot.docs.length - 1];
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const card = document.createElement('div');
            card.className = 'gallery-card';

            if (data.mediaType === 'video') {
                card.innerHTML = `<video src="${data.mediaURL}" controls style="width:100%; height:100%; object-fit:cover;"></video>`;
            } else {
                card.innerHTML = `<img src="${data.mediaURL}" alt="Party Event" onclick="window.open('${data.mediaURL}')" style="cursor:pointer;">`;
            }

            galleryContainer.appendChild(card);
        });

        // Hide "Load More" button if we got fewer than 10 results (meaning no more left)
        if (loadMoreGalleryBtn) {
            if (snapshot.docs.length < GALLERY_BATCH_SIZE) {
                loadMoreGalleryBtn.style.display = 'none';
            } else {
                loadMoreGalleryBtn.style.display = 'block';
            }
        }

    } catch (error) {
        console.error("Gallery Error:", error);
    }
}

// Initial Gallery Load
if(loadMoreGalleryBtn) {
    loadMoreGalleryBtn.addEventListener('click', loadUserGallery);
}
loadUserGallery();

// --- BOOKING FORM LOGIC (WhatsApp & Email) ---
window.sendBooking = function(type) {
    // 1. Get Values
    const name = document.getElementById('bookName').value;
    const phone = document.getElementById('bookPhone').value;
    const address = document.getElementById('bookAddress').value;
    const date = document.getElementById('bookDate').value;
    const eventType = document.getElementById('bookType').value;

    // 2. Validation
    if(!name || !phone || !date) {
        alert("Please fill in Name, Phone Number, and Date.");
        return;
    }

    // 3. Create Message
    const message = `*New Booking Enquiry*\n\n` +
                    `*Name:* ${name}\n` +
                    `*Phone:* ${phone}\n` +
                    `*Event Type:* ${eventType}\n` +
                    `*Date:* ${date}\n` +
                    `*Address:* ${address}\n\n` +
                    `Please confirm availability.`;

    // 4. Send
    if(type === 'whatsapp') {
        // Open WhatsApp
        const waLink = `https://wa.me/917530886327?text=${encodeURIComponent(message)}`;
        window.open(waLink, '_blank');
    } else if(type === 'email') {
        // Open Email App
        const subject = `Booking Enquiry - ${name}`;
        const mailLink = `mailto:MagicianSudip@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
        window.location.href = mailLink;
    }
};