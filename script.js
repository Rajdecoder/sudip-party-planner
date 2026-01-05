// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { addDoc, collection, getDocs, getFirestore, limit, orderBy, query, serverTimestamp, startAfter, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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

// --- GALLERY LOGIC VARIABLES ---
let currentCategory = 'All';
let lastGalleryVisible = null;
const GALLERY_BATCH_SIZE = 10;
let currentGalleryItems = []; 

// --- 1. FILTER FUNCTION ---
window.filterGallery = function(category) {
    currentCategory = category;
    lastGalleryVisible = null; 
    currentGalleryItems = []; 
    
    // Update Active Button State
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if(btn.innerText.includes(category) || (category === 'All' && btn.innerText === 'All')) {
            btn.classList.add('active');
        }
    });

    const galleryContainer = document.getElementById('dynamicGallery');
    if(galleryContainer) galleryContainer.innerHTML = "<p style='text-align:center; width:100%; color:#666;'>Loading...</p>";
    
    loadUserGallery();
}

// --- 2. LOAD GALLERY ---
async function loadUserGallery() {
    const galleryContainer = document.getElementById('dynamicGallery');
    const loadMoreBtn = document.getElementById('loadMoreGalleryBtn');
    if (!galleryContainer) return;

    try {
        let q;
        const colRef = collection(db, "gallery");

        // QUERY LOGIC
        if (currentCategory === 'All') {
            if (!lastGalleryVisible) {
                q = query(colRef, orderBy("createdAt", "desc"), limit(GALLERY_BATCH_SIZE));
            } else {
                q = query(colRef, orderBy("createdAt", "desc"), startAfter(lastGalleryVisible), limit(GALLERY_BATCH_SIZE));
            }
        } else {
            if (!lastGalleryVisible) {
                q = query(colRef, where("eventType", "==", currentCategory), orderBy("createdAt", "desc"), limit(GALLERY_BATCH_SIZE));
            } else {
                q = query(colRef, where("eventType", "==", currentCategory), orderBy("createdAt", "desc"), startAfter(lastGalleryVisible), limit(GALLERY_BATCH_SIZE));
            }
        }

        const snapshot = await getDocs(q);

        // Clear "Loading" text
        if (!lastGalleryVisible && galleryContainer.innerHTML.includes('Loading')) {
            galleryContainer.innerHTML = "";
        }

        if (snapshot.empty && !lastGalleryVisible) {
            galleryContainer.innerHTML = "<p style='text-align:center; width:100%; color:#666;'>No photos found for this category yet.</p>";
            if(loadMoreBtn) loadMoreBtn.style.display = 'none';
            return;
        }

        if (!snapshot.empty) {
            lastGalleryVisible = snapshot.docs[snapshot.docs.length - 1];
        }

        let startIndex = currentGalleryItems.length;
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            currentGalleryItems.push(data);
            
            const card = document.createElement('div');
            card.className = 'gallery-card';
            
            const indexToOpen = startIndex; 

            if (data.mediaType === 'video') {
                card.innerHTML = `<video src="${data.mediaURL}#t=1.0" preload="metadata" style="width:100%; height:100%; object-fit:cover;"></video>
                                  <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:white; font-size:30px; pointer-events:none;"><i class="fas fa-play-circle"></i></div>`;
                card.onclick = () => window.openLightbox(indexToOpen);
            } else {
                card.innerHTML = `<img src="${data.mediaURL}" alt="Party Event">`;
                card.onclick = () => window.openLightbox(indexToOpen);
            }

            galleryContainer.appendChild(card);
            startIndex++;
        });

        if (loadMoreBtn) {
            loadMoreBtn.style.display = (snapshot.docs.length < GALLERY_BATCH_SIZE) ? 'none' : 'block';
            
            // Remove old listener to prevent duplicates
            const newBtn = loadMoreBtn.cloneNode(true);
            loadMoreBtn.parentNode.replaceChild(newBtn, loadMoreBtn);
            newBtn.addEventListener('click', loadUserGallery);
        }

    } catch (error) {
        console.error("Gallery Error:", error);
        if(error.message.includes("index")) {
            console.warn("Index missing. Check Firebase Console.");
        }
    }
}

// Initial Load
loadUserGallery();


// --- 3. LIGHTBOX LOGIC ---
let currentSlideIndex = 0;

window.openLightbox = function(index) {
    currentSlideIndex = index;
    const lightbox = document.getElementById('lightbox');
    lightbox.style.display = 'flex';
    showLightboxContent();
}

window.closeLightbox = function() {
    document.getElementById('lightbox').style.display = 'none';
    const container = document.getElementById('lightbox-container');
    container.innerHTML = "";
}

window.changeSlide = function(n) {
    currentSlideIndex += n;
    
    if (currentSlideIndex >= currentGalleryItems.length) {
        currentSlideIndex = 0;
    } else if (currentSlideIndex < 0) {
        currentSlideIndex = currentGalleryItems.length - 1;
    }
    
    showLightboxContent();
}

function showLightboxContent() {
    const container = document.getElementById('lightbox-container');
    const item = currentGalleryItems[currentSlideIndex];
    
    if(!item) return;

    if (item.mediaType === 'video') {
        container.innerHTML = `<video src="${item.mediaURL}" controls autoplay class="lightbox-content"></video>`;
    } else {
        container.innerHTML = `<img src="${item.mediaURL}" class="lightbox-content">`;
    }
}

// Close on background click
const lb = document.getElementById('lightbox');
if(lb) {
    lb.addEventListener('click', (e) => {
        if(e.target.id === 'lightbox') window.closeLightbox();
    });
}

// --- NEW: KEYBOARD SUPPORT (Arrow Keys & Escape) ---
document.addEventListener('keydown', function(event) {
    const lightbox = document.getElementById('lightbox');
    // Only work if lightbox is visible
    if (lightbox && lightbox.style.display === 'flex') {
        if (event.key === 'ArrowLeft') {
            window.changeSlide(-1);
        } else if (event.key === 'ArrowRight') {
            window.changeSlide(1);
        } else if (event.key === 'Escape') {
            window.closeLightbox();
        }
    }
});


// --- 4. REVIEW & STAR RATING LOGIC ---
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
    stars.forEach(s => s.style.color = "#ffc107");
}

const reviewForm = document.getElementById('reviewForm');
const fileInput = document.getElementById('reviewMedia');

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

if(reviewForm) {
    const submitBtn = document.getElementById('submitBtn');
    const progressBar = document.getElementById('progressBar');
    const uploadStatus = document.getElementById('uploadStatus');

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

// --- 5. LOAD REVIEWS ---
const reviewsContainer = document.getElementById('reviewsContainer');
const loadReviewsBtn = document.getElementById('loadMoreBtn');
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
            if(loadReviewsBtn) loadReviewsBtn.style.display = 'none';
            return;
        }

        if (!querySnapshot.empty) {
            lastReviewVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            let stars = "";
            for(let i=1; i<=5; i++) stars += (i<=data.rating) ? '<i class="fas fa-star" style="color:#f1c40f"></i>' : '<i class="fas fa-star" style="color:#ccc"></i>';

            let media = "";
            if(data.mediaURL) {
                const content = (data.mediaType === 'video') 
                    ? `<video controls src="${data.mediaURL}" style="max-width:100%; border-radius:5px; margin-top:10px;"></video>` 
                    : `<img src="${data.mediaURL}" alt="User Review" style="max-width:100%; border-radius:5px; margin-top:10px;">`;
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

        if(loadReviewsBtn) {
            loadReviewsBtn.style.display = (querySnapshot.docs.length < REVIEW_BATCH_SIZE) ? 'none' : 'block';
        }

    } catch (error) {
        console.error("Error loading reviews:", error);
    }
}

if(loadReviewsBtn) loadReviewsBtn.addEventListener('click', loadReviews);
loadReviews();


// --- 6. BOOKING FORM LOGIC ---
window.sendBooking = function(type) {
    const name = document.getElementById('bookName').value;
    const phone = document.getElementById('bookPhone').value;
    const address = document.getElementById('bookAddress').value;
    const date = document.getElementById('bookDate').value;
    const eventType = document.getElementById('bookType').value;

    if(!name || !phone || !date) {
        alert("Please fill in Name, Phone Number, and Date.");
        return;
    }

    const message = `*New Booking Enquiry*\n\n` +
                    `*Name:* ${name}\n` +
                    `*Phone:* ${phone}\n` +
                    `*Event Type:* ${eventType}\n` +
                    `*Date:* ${date}\n` +
                    `*Address:* ${address}\n\n` +
                    `Please confirm availability.`;

    if(type === 'whatsapp') {
        const waLink = `https://wa.me/917530886327?text=${encodeURIComponent(message)}`;
        window.open(waLink, '_blank');
    } else if(type === 'email') {
        const subject = `Booking Enquiry - ${name}`;
        const mailLink = `mailto:MagicianSudip@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
        window.location.href = mailLink;
    }
};

// --- 7. PREVIEW LOGIC ---
const previewContainer = document.getElementById('previewContainer');
const imagePreview = document.getElementById('imagePreview');
const videoPreview = document.getElementById('videoPreview');
const uploadBtnText = document.getElementById('uploadBtnText');

if(fileInput) {
    fileInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            if(previewContainer) previewContainer.style.display = 'block';
            if(uploadBtnText) uploadBtnText.textContent = "Change File";
            
            if(imagePreview) { imagePreview.style.display = 'none'; imagePreview.src = ""; }
            if(videoPreview) { videoPreview.style.display = 'none'; videoPreview.src = ""; }

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
        }
    });
}