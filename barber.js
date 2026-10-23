// Backend Version - Connected to Node.js Server
const API_BASE = ""; // Base URL for API calls
let is_open = true; // Status can be managed via backend too, but for now kept simple
const closedMessage = "Sorry bro, the barbershop is closed right now. We will be back soon!";
let pendingBooking = null;

function checkStatus() {
    const banner = document.getElementById('status-banner');
    const bookBtn = document.getElementById('book-btn');
    
    if (!is_open) {
        banner.style.display = 'block';
        banner.className = 'status-closed';
        banner.innerText = closedMessage;
        bookBtn.disabled = true;
        bookBtn.innerText = "SHOP CLOSED";
    } else {
        banner.style.display = 'none';
        bookBtn.disabled = false;
        bookBtn.innerText = "Confirm & Pay via QR";
    }
}

function toggleShopStatus() {
    is_open = !is_open;
    checkStatus();
    alert(`Shop is now ${is_open ? 'OPEN' : 'CLOSED'}`);
}

// Dynamic Slot Generation Logic
function getSlotsForService(service) {
    if (service === 'haircut') {
        return ["10:00", "11:30", "14:00", "15:30"];
    } else {
        const slots = [];
        for (let h = 10; h < 17; h++) {
            if (h === 13) continue; // Lunch
            slots.push(`${h}:00`, `${h}:30`);
        }
        return slots;
    }
}

function renderTimeSlots() {
    const service = document.getElementById('service').value;
    const dateStr = document.getElementById('date').value;
    const grid = document.getElementById('time-grid');
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #888;">Loading slots...</p>';
    
    if (!dateStr) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #888;">Please select a date first.</p>';
        return;
    }

    const selectedDate = new Date(dateStr);
    const dayOfWeek = selectedDate.getDay();

    // Frontend validation for service dates
    if (service === 'haircut' && dayOfWeek !== 0 && dayOfWeek !== 6) {
        grid.innerHTML = '<p style="color: #ff4d4d; grid-column: 1/-1; text-align: center; background: rgba(255,0,0,0.1); padding: 15px; border-radius: 10px; border: 1px solid rgba(255,0,0,0.2);"><strong>Haircuts are WEEKENDS ONLY.</strong><br>Please select a Saturday or Sunday on the calendar above.</p>';
        return;
    }
    if (service === 'beard' && dayOfWeek !== 5) {
        grid.innerHTML = '<p style="color: #ff4d4d; grid-column: 1/-1; text-align: center; background: rgba(255,0,0,0.1); padding: 15px; border-radius: 10px; border: 1px solid rgba(255,0,0,0.2);"><strong>Beard trims are FRIDAYS ONLY.</strong><br>Please select a Friday on the calendar above.</p>';
        return;
    }

    // Fetch taken slots from server
    fetch(`${API_BASE}/api/bookings?date=${dateStr}`)
        .then(res => res.json())
        .then(takenSlots => {
            const slots = getSlotsForService(service);
            const now = new Date();
            const isToday = selectedDate.toDateString() === now.toDateString();

            grid.innerHTML = '';
            let availableCount = 0;

            slots.forEach(time => {
                const [hour, minute] = time.split(':').map(Number);
                const slotDate = new Date(selectedDate);
                slotDate.setHours(hour, minute, 0, 0);

                const slot = document.createElement('div');
                slot.className = 'time-slot';
                slot.innerText = time;
                
                const isPast = isToday && slotDate < now;
                const isTaken = takenSlots.includes(time);

                if (isTaken || isPast) {
                    slot.classList.add('taken');
                    slot.title = isTaken ? "Already booked" : "Time passed";
                } else {
                    slot.onclick = () => selectTime(slot, time);
                    availableCount++;
                }
                grid.appendChild(slot);
            });

            if (availableCount === 0) {
                grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #ffbc00; background: rgba(255,188,0,0.1); padding: 10px; border-radius: 10px;">All slots for this day are fully booked or past. Try another date!</p>';
            }
        })
        .catch(err => {
            console.error("Error fetching slots:", err);
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #ff4d4d;">Error connecting to server. Please try again later.</p>';
        });
}

function selectTime(element, time) {
    document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
    element.classList.add('selected');
    document.getElementById('selected-time').value = time;
}

// Global modal controls
window.closePaymentModal = function() {
    document.getElementById('payment-modal').style.display = 'none';
    pendingBooking = null;
};

window.confirmPayment = function() {
    if (!pendingBooking) return;
    
    const confirmBtn = document.querySelector('#payment-modal .btn-primary');
    const originalText = confirmBtn.innerText;
    confirmBtn.innerText = "Processing...";
    confirmBtn.disabled = true;

    fetch(`${API_BASE}/api/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingBooking)
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
            confirmBtn.innerText = originalText;
            confirmBtn.disabled = false;
        } else {
            // Hide payment modal, show status overlay
            document.getElementById('payment-modal').style.display = 'none';
            showStatusOverlay(data.id);
        }
    })
    .catch(err => {
        alert("Something went wrong connection to the server. Please check if backend is running.");
        confirmBtn.innerText = originalText;
        confirmBtn.disabled = false;
    });
};

function showStatusOverlay(bookingId) {
    const overlay = document.getElementById('status-overlay');
    overlay.style.display = 'flex';
    
    // Poll for status
    const pollInterval = setInterval(() => {
        fetch(`${API_BASE}/api/booking-status/${bookingId}`)
            .then(res => res.json())
            .then(data => {
                if (data.status === 'confirmed') {
                    clearInterval(pollInterval);
                    document.getElementById('status-title').innerText = "Payment Received!";
                    document.getElementById('status-desc').innerText = "The master has confirmed your payment. Redirecting...";
                    document.getElementById('status-spinner').style.display = 'none';
                    setTimeout(() => {
                        alert("SUCCESS! Your booking is confirmed. See you then bro!");
                        location.reload();
                    }, 2000);
                } else if (data.status === 'rejected') {
                    clearInterval(pollInterval);
                    document.getElementById('status-title').innerText = "Payment Not Received";
                    document.getElementById('status-title').style.color = "#e74c3c";
                    document.getElementById('status-desc').innerText = "The master could not find your payment. Please contact +996 552 766 222.";
                    document.getElementById('status-spinner').style.display = 'none';
                    
                    const closeBtn = document.createElement('button');
                    closeBtn.innerText = "Close";
                    closeBtn.className = "btn-secondary";
                    closeBtn.style.marginTop = "20px";
                    closeBtn.onclick = () => location.reload();
                    document.querySelector('#status-overlay .modal-content').appendChild(closeBtn);
                }
            })
            .catch(err => console.error("Polling error:", err));
    }, 3000); // Check every 3s
}

// Initial Setup
const dateInput = document.getElementById('date');
const serviceInput = document.getElementById('service');

if (dateInput) {
    const todayStr = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', todayStr);
    dateInput.value = todayStr;
    dateInput.addEventListener('change', renderTimeSlots);
}

if (serviceInput) {
    serviceInput.addEventListener('change', renderTimeSlots);
}

const form = document.getElementById('book-form');
if (form) {
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const time = document.getElementById('selected-time').value;
        if (!time) {
            alert("Please select a time slot!");
            return;
        }

        const service = document.getElementById('service').value;
        const price = service === 'haircut' ? 400 : 200;

        // Populate and show modal
        document.getElementById('payment-amount').innerText = price;
        document.getElementById('payment-service').innerText = service === 'haircut' ? 'Haircut' : 'Beard Trim';
        
        pendingBooking = {
            name: document.getElementById('name').value,
            phone: document.getElementById('phone').value,
            service: service,
            date: document.getElementById('date').value,
            time: time,
            bank: document.getElementById('bank').value
        };

        document.getElementById('payment-modal').style.display = 'flex';
    });
}

// Start up
renderTimeSlots();
checkStatus();
