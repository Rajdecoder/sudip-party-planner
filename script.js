// const burger = document.querySelector('.burger');
// const nav = document.querySelector('.nav-links');
// const navLinks = document.querySelectorAll('.nav-links li');

// // Toggle Menu
// burger.addEventListener('click', () => {
//     // Toggle Nav
//     nav.classList.toggle('nav-active');

//     // Burger Animation
//     burger.classList.toggle('toggle');
// });

// // Close menu when a link is clicked
// navLinks.forEach(link => {
//     link.addEventListener('click', () => {
//         nav.classList.remove('nav-active');
//         burger.classList.remove('toggle');
//     });
// });

// // Smooth Scrolling
// document.querySelectorAll('a[href^="#"]').forEach(anchor => {
//     anchor.addEventListener('click', function (e) {
//         e.preventDefault();

//         document.querySelector(this.getAttribute('href')).scrollIntoView({
//             behavior: 'smooth'
//         });
//     });
// });
// --- Navigation Logic ---
const burger = document.querySelector('.burger');
const nav = document.querySelector('.nav-links');
const navLinks = document.querySelectorAll('.nav-links li');

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

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// --- Review System Logic ---

const reviewForm = document.getElementById('reviewForm');
const reviewsContainer = document.getElementById('reviewsContainer');
const fileInput = document.getElementById('reviewMedia');
const previewContainer = document.getElementById('previewContainer');
const imagePreview = document.getElementById('imagePreview');

// 1. Show Image Preview when user selects a file
fileInput.addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            imagePreview.src = e.target.result;
            previewContainer.style.display = 'block';
        }
        reader.readAsDataURL(file);
    } else {
        previewContainer.style.display = 'none';
    }
});

// 2. Handle Form Submit
reviewForm.addEventListener('submit', function(e) {
    e.preventDefault(); // Stop page refresh

    // Get Values
    const name = document.getElementById('reviewerName').value;
    const text = document.getElementById('reviewerText').value;
    const file = fileInput.files[0];
    
    // Create new Review Card HTML
    const newCard = document.createElement('div');
    newCard.classList.add('review-card');

    let mediaHTML = '';
    
    // If there is an image, process it
    if (file) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function(e) {
            // We use the file reader result to show the image instantly
            completeReviewCreation(name, text, e.target.result);
        }
    } else {
        completeReviewCreation(name, text, null);
    }

    function completeReviewCreation(userName, userText, mediaSrc) {
        if(mediaSrc) {
            mediaHTML = `<div class="review-media"><img src="${mediaSrc}" alt="User Upload"></div>`;
        }

        newCard.innerHTML = `
            <div class="review-header">
                <img src="https://via.placeholder.com/50/ff4757/ffffff?text=${userName.charAt(0)}" alt="User">
                <div>
                    <h4>${userName}</h4>
                    <div class="stars">
                        <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
                    </div>
                </div>
            </div>
            <p class="review-text">"${userText}"</p>
            ${mediaHTML}
        `;

        // Add to top of list
        reviewsContainer.prepend(newCard);

        // Reset Form
        reviewForm.reset();
        previewContainer.style.display = 'none';
        alert('Thank you! Your review has been added.');
    }
});