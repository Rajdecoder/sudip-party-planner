// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, startAfter, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCDuau7j4CyfotHfMr0svnDY8hp10F3f3M",
  authDomain: "sudipparty-24d31.firebaseapp.com",
  projectId: "sudipparty-24d31",
  storageBucket: "sudipparty-24d31.firebasestorage.app",
  messagingSenderId: "372149822854",
  appId: "1:372149822854:web:ca02d0536a604a31703807"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// GLOBAL VARIABLES
let currentCategory = 'All';
let lastGalleryVisible = null;
const GALLERY_BATCH_SIZE = 10;
const REVIEW_BATCH_SIZE = 5;
let lastReviewVisible = null;

// Lightbox Queue & Index (Used for both Gallery and Reviews)
let lightboxQueue = []; 
let currentSlideIndex = 0;
// We keep a separate Master List for the main gallery so we don't lose it when opening reviews
let galleryMasterList = []; 

// --- 1. GALLERY LOGIC ---
window.filterGallery = function(category) {
    currentCategory = category;
    lastGalleryVisible = null;
    galleryMasterList = []; // Reset master list on filter change
    
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

async function loadUserGallery() {
    const galleryContainer = document.getElementById('dynamicGallery');
    const loadMoreBtn = document.getElementById('loadMoreGalleryBtn');
    if (!galleryContainer) return;

    try {
        let q;
        const colRef = collection(db, "gallery");

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

        if (!lastGalleryVisible && galleryContainer.innerHTML.includes('Loading')) {
            galleryContainer.innerHTML = "";
        }

        if (snapshot.empty && !lastGalleryVisible) {
            galleryContainer.innerHTML = "<p style='text-align:center; width:100%; color:#666;'>No photos found for this category.</p>";
            if(loadMoreBtn) loadMoreBtn.style.display = 'none';
            return;
        }

        if (!snapshot.empty) lastGalleryVisible = snapshot.docs[snapshot.docs.length - 1];

        // Capture starting index for this batch relative to master list
        let startIndex = galleryMasterList.length;

        snapshot.forEach((doc) => {
            const data = doc.data();
            // Add to master gallery list
            galleryMasterList.push({ url: data.mediaURL, type: data.mediaType });
            
            const card = document.createElement('div');
            card.className = 'gallery-card';
            const index = startIndex; // Lock index for closure

            if (data.mediaType === 'video') {
                card.innerHTML = `<video src="${data.mediaURL}#t=1.0" preload="metadata"></video><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:white;font-size:30px;"><i class="fas fa-play-circle"></i></div>`;
            } else {
                card.innerHTML = `<img src="${data.mediaURL}" alt="Party">`;
            }
            
            // On click, open lightbox with the FULL gallery list
            card.onclick = () => openLightbox(galleryMasterList, index);
            galleryContainer.appendChild(card);
            startIndex++;
        });

        if (loadMoreBtn) {
            loadMoreBtn.style.display = (snapshot.docs.length < GALLERY_BATCH_SIZE) ? 'none' : 'block';
            const newBtn = loadMoreBtn.cloneNode(true);
            loadMoreBtn.parentNode.replaceChild(newBtn, loadMoreBtn);
            newBtn.addEventListener('click', loadUserGallery);
        }

    } catch (error) {
        console.error("Gallery Error:", error);
    }
}

// --- 2. LIGHTBOX LOGIC (UNIFIED & ISOLATED) ---
// This function sets the queue to whatever list is passed (Main Gallery OR Specific Review Items)
window.openLightbox = function(items, index) {
    lightboxQueue = items;
    currentSlideIndex = index;
    const lightbox = document.getElementById('lightbox');
    
    // Toggle Arrows if multiple items exist in this queue
    const prevBtn = document.querySelector('.lightbox-prev');
    const nextBtn = document.querySelector('.lightbox-next');
    if (lightboxQueue.length > 1) {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
    } else {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
    }

    lightbox.style.display = 'flex';
    showLightboxContent();
}

window.closeLightbox = function() {
    document.getElementById('lightbox').style.display = 'none';
    document.getElementById('lightbox-container').innerHTML = "";
}

window.changeSlide = function(n) {
    currentSlideIndex += n;
    // Circular Logic
    if (currentSlideIndex >= lightboxQueue.length) currentSlideIndex = 0;
    if (currentSlideIndex < 0) currentSlideIndex = lightboxQueue.length - 1;
    showLightboxContent();
}

function showLightboxContent() {
    const container = document.getElementById('lightbox-container');
    const item = lightboxQueue[currentSlideIndex];
    if(!item) return;

    if (item.type === 'video') {
        container.innerHTML = `<video src="${item.url}" controls autoplay class="lightbox-content"></video>`;
    } else {
        container.innerHTML = `<img src="${item.url}" class="lightbox-content">`;
    }
}

// Lightbox Events (Keys & Touch)
const lb = document.getElementById('lightbox');
if(lb) {
    lb.addEventListener('click', (e) => {
        if(e.target.id === 'lightbox') window.closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
        if (lb.style.display === 'flex') {
            if (e.key === 'ArrowLeft') window.changeSlide(-1);
            if (e.key === 'ArrowRight') window.changeSlide(1);
            if (e.key === 'Escape') window.closeLightbox();
        }
    });

    // Touch Swipe Logic
    let touchStartX = 0;
    lb.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; });
    lb.addEventListener('touchend', e => {
        let touchEndX = e.changedTouches[0].screenX;
        // Only swipe if multiple items exist
        if (lightboxQueue.length > 1) {
            if (touchEndX < touchStartX - 50) window.changeSlide(1); // Swipe Left -> Next
            if (touchEndX > touchStartX + 50) window.changeSlide(-1); // Swipe Right -> Prev
        }
    });
}

// --- 3. REVIEWS LOGIC (UPDATED FOR ISOLATION) ---
async function loadReviews() {
    const reviewsContainer = document.getElementById('reviewsContainer');
    const loadReviewsBtn = document.getElementById('loadMoreBtn');
    if(!reviewsContainer) return;

    let q;
    if (!lastReviewVisible) {
        q = query(collection(db, "reviews"), orderBy("createdAt", "desc"), limit(REVIEW_BATCH_SIZE));
    } else {
        q = query(collection(db, "reviews"), orderBy("createdAt", "desc"), startAfter(lastReviewVisible), limit(REVIEW_BATCH_SIZE));
    }

    try {
        const snapshot = await getDocs(q);
        if (!lastReviewVisible && snapshot.empty) {
            reviewsContainer.innerHTML = "<p style='text-align:center;'>No reviews yet.</p>";
            if(loadReviewsBtn) loadReviewsBtn.style.display = 'none';
            return;
        }
        if (!snapshot.empty) lastReviewVisible = snapshot.docs[snapshot.docs.length - 1];

        snapshot.forEach((doc) => {
            const data = doc.data();
            
            // Stars
            let stars = "";
            for(let i=1; i<=5; i++) stars += (i<=data.rating) ? '<i class="fas fa-star" style="color:#f1c40f"></i>' : '<i class="fas fa-star" style="color:#ccc"></i>';

            // Media Handling (Supports Old & New Format)
            let mediaHtml = "";
            let thisReviewsMedia = []; // Isolated list for THIS review

            if(data.mediaItems && Array.isArray(data.mediaItems)) {
                thisReviewsMedia = data.mediaItems;
            } else if (data.mediaURL) {
                thisReviewsMedia.push({ url: data.mediaURL, type: data.mediaType });
            }

            if (thisReviewsMedia.length > 0) {
                let thumbs = "";
                thisReviewsMedia.forEach((item, idx) => {
                    const content = (item.type === 'video') 
                        ? `<i class="fas fa-play" style="position:absolute;color:white;left:35%;top:35%;"></i><video src="${item.url}#t=1.0" style="pointer-events:none;"></video>` 
                        : `<img src="${item.url}">`;
                    
                    // Unique ID for binding click event
                    thumbs += `<button class="review-media-btn" id="rev-${doc.id}-${idx}">${content}</button>`;
                });
                mediaHtml = `<div class="review-media-grid">${thumbs}</div>`;
            }

            const div = document.createElement("div");
            div.className = "review-card";
            div.innerHTML = `
                <div class="review-header">
                    <div style="width:40px;height:40px;background:#ff4757;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;margin-right:10px;">${data.name.charAt(0).toUpperCase()}</div>
                    <div><h4 style="margin:0;">${data.name}</h4><div class="stars">${stars}</div></div>
                </div>
                <p class="review-text">"${data.text}"</p>
                ${mediaHtml}
            `;
            reviewsContainer.appendChild(div);

            // Bind click events: Pass ONLY thisReviewsMedia to openLightbox
            if (thisReviewsMedia.length > 0) {
                thisReviewsMedia.forEach((item, idx) => {
                    const btn = document.getElementById(`rev-${doc.id}-${idx}`);
                    if(btn) btn.onclick = () => openLightbox(thisReviewsMedia, idx);
                });
            }
        });

        if (loadReviewsBtn) {
            loadReviewsBtn.style.display = (snapshot.docs.length < REVIEW_BATCH_SIZE) ? 'none' : 'block';
            const newBtn = loadReviewsBtn.cloneNode(true);
            loadReviewsBtn.parentNode.replaceChild(newBtn, loadReviewsBtn);
            newBtn.addEventListener('click', loadReviews);
        }

    } catch (error) { console.error(error); }
}

// --- 4. REVIEW FORM (Multi-File + Limit) ---
const reviewForm = document.getElementById('reviewForm');
const fileInput = document.getElementById('reviewMedia');

if(reviewForm) {
    const starsInput = document.querySelectorAll('#starRatingInput i');
    const ratingValue = document.getElementById('selectedRating');
    starsInput.forEach(s => s.addEventListener('click', () => {
        const val = s.getAttribute('data-value');
        ratingValue.value = val;
        starsInput.forEach(st => st.style.color = (st.getAttribute('data-value') <= val) ? "#f1c40f" : "#ccc");
    }));

    reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('submitBtn');
        const progressBar = document.getElementById('progressBar');
        const uploadStatus = document.getElementById('uploadStatus');
        
        const files = fileInput.files;
        
        // LIMIT CHECK
        if(files.length > 5) {
            alert("Maximum 5 files allowed per review.");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = "Processing...";
        let mediaItems = [];

        try {
            if (files.length > 0) {
                uploadStatus.style.display = 'block';
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    // Compress Image logic (simplified)
                    const storageRef = ref(storage, 'reviews/' + Date.now() + '-' + i + '-' + file.name);
                    const uploadTask = uploadBytesResumable(storageRef, file);
                    const url = await new Promise((resolve, reject) => {
                        uploadTask.on('state_changed', 
                            (snap) => progressBar.style.width = (snap.bytesTransferred / snap.totalBytes * 100) + '%',
                            reject, 
                            () => getDownloadURL(uploadTask.snapshot.ref).then(resolve)
                        );
                    });
                    mediaItems.push({ url: url, type: file.type.startsWith('video') ? 'video' : 'image' });
                }
            }

            await addDoc(collection(db, "reviews"), {
                name: document.getElementById('reviewerName').value,
                text: document.getElementById('reviewerText').value,
                rating: parseInt(ratingValue.value),
                mediaItems: mediaItems, // Save array
                createdAt: serverTimestamp()
            });

            alert("Posted!"); window.location.reload();
        } catch (err) { alert(err.message); } 
        finally { submitBtn.disabled = false; }
    });

    fileInput.addEventListener('change', function() {
        const container = document.getElementById('previewContainer');
        container.innerHTML = "";
        
        if (this.files.length > 5) {
            alert("Max 5 files!");
            this.value = ""; // Clear input
            return;
        }

        Array.from(this.files).forEach(file => {
            const el = document.createElement(file.type.startsWith('video') ? 'video' : 'img');
            el.src = URL.createObjectURL(file);
            el.style = "width:60px;height:60px;object-fit:cover;border-radius:5px;";
            container.appendChild(el);
        });
        document.getElementById('uploadBtnText').textContent = `${this.files.length} Files`;
    });
}

// Init
loadUserGallery();
loadReviews();

// Global Booking
window.sendBooking = function(type) {
    const name = document.getElementById('bookName').value;
    const phone = document.getElementById('bookPhone').value;
    if(!name || !phone) return alert("Fill Name & Phone");
    const msg = `Booking: ${name}, ${phone}, ${document.getElementById('bookType').value}`;
    if(type === 'whatsapp') window.open(`https://wa.me/917530886327?text=${encodeURIComponent(msg)}`);
    else window.location.href = `mailto:MagicianSudip@gmail.com?subject=Booking&body=${encodeURIComponent(msg)}`;
};