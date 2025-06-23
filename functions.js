<script>
        // Global variables for timezone and sync
        let selectedTimezone = 'local';
        let timeOffset = 0; // Offset in milliseconds
        let useServerTime = false;
        
        // Get current time with timezone support
        function getCurrentTime() {
            let now = new Date();
            
            if (useServerTime) {
                now = new Date(now.getTime() + timeOffset);
            }
            
            if (selectedTimezone === 'local') {
                return now;
            } else if (selectedTimezone === 'UTC') {
                return new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
            } else {
                // Use Intl API for other timezones
                try {
                    const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
                    const targetTime = new Date(utc.toLocaleString('en-US', {timeZone: selectedTimezone}));
                    return targetTime;
                } catch (e) {
                    return now; // Fallback to local time
                }
            }
        }
        
        // Sync time with world time API
        async function syncTime() {
            const syncButton = document.getElementById('syncButton');
            const syncStatus = document.getElementById('syncStatus');
            
            syncButton.textContent = 'Syncing...';
            syncButton.disabled = true;
            syncStatus.textContent = 'Synchronizing time...';
            syncStatus.className = 'sync-status';
            
            try {
                // Try multiple APIs for better reliability
                let data;
                
                // First try: WorldTimeAPI with HTTPS
                try {
                    const response = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC', {
                        method: 'GET',
                        mode: 'cors'
                    });
                    
                    if (!response.ok) throw new Error('WorldTimeAPI failed');
                    data = await response.json();
                    
                    const serverTime = new Date(data.datetime);
                    const localTime = new Date();
                    timeOffset = serverTime.getTime() - localTime.getTime();
                    
                    // Sanity check: offset should be reasonable (within 1 hour = 3600s)
                    if (Math.abs(timeOffset) > 3600000) {
                        throw new Error(`Unreasonable offset: ${Math.round(timeOffset/1000)}s`);
                    }
                    
                    useServerTime = true;
                    syncStatus.textContent = `Synced with WorldTimeAPI (offset: ${timeOffset > 0 ? '+' : ''}${Math.round(timeOffset/1000)}s)`;
                    syncStatus.className = 'sync-status success';
                    
                } catch (apiError) {
                    console.log('WorldTimeAPI failed:', apiError.message);
                    
                    // Fallback: Use a different time API with better parsing
                    try {
                        const response = await fetch('https://timeapi.io/api/Time/current/zone?timeZone=UTC', {
                            method: 'GET',
                            mode: 'cors'
                        });
                        
                        if (!response.ok) throw new Error('TimeAPI failed');
                        data = await response.json();
                        
                        console.log('TimeAPI response:', data); // Debug log
                        
                        // Try different date fields that might exist
                        let serverTime;
                        if (data.dateTime) {
                            serverTime = new Date(data.dateTime);
                        } else if (data.datetime) {
                            serverTime = new Date(data.datetime);
                        } else if (data.utc_datetime) {
                            serverTime = new Date(data.utc_datetime);
                        } else {
                            throw new Error('No valid time field found in response');
                        }
                        
                        const localTime = new Date();
                        timeOffset = serverTime.getTime() - localTime.getTime();
                        
                        console.log('TimeAPI offset calculation:', {
                            serverTime: serverTime.toISOString(),
                            localTime: localTime.toISOString(),
                            offsetMs: timeOffset,
                            offsetSeconds: Math.round(timeOffset/1000)
                        });
                        
                        // Sanity check: offset should be reasonable (within 1 hour = 3600s)
                        if (Math.abs(timeOffset) > 3600000) {
                            throw new Error(`Unreasonable TimeAPI offset: ${Math.round(timeOffset/1000)}s`);
                        }
                        
                        useServerTime = true;
                        syncStatus.textContent = `Synced with TimeAPI (offset: ${timeOffset > 0 ? '+' : ''}${Math.round(timeOffset/1000)}s)`;
                        syncStatus.className = 'sync-status success';
                        
                    } catch (apiError2) {
                        console.log('TimeAPI also failed:', apiError2.message);
                        
                        // Last resort: HTTP header method (most reliable)
                        const startTime = performance.now();
                        const response = await fetch('https://httpbin.org/headers', {
                            method: 'GET',
                            mode: 'cors'
                        });
                        const endTime = performance.now();
                        const networkDelay = (endTime - startTime) / 2; // Rough estimate
                        
                        // Get the Date header from the response
                        const serverDateHeader = response.headers.get('date');
                        if (serverDateHeader) {
                            const serverTime = new Date(serverDateHeader);
                            const localTime = new Date();
                            timeOffset = serverTime.getTime() - localTime.getTime() + networkDelay;
                            
                            console.log('HTTP header sync:', {
                                serverHeader: serverDateHeader,
                                serverTime: serverTime.toISOString(),
                                localTime: localTime.toISOString(),
                                networkDelay: Math.round(networkDelay),
                                offsetMs: timeOffset,
                                offsetSeconds: Math.round(timeOffset/1000)
                            });
                            
                            // Sanity check: offset should be reasonable
                            if (Math.abs(timeOffset) > 3600000) {
                                throw new Error(`Unreasonable HTTP offset: ${Math.round(timeOffset/1000)}s`);
                            }
                            
                            useServerTime = true;
                            syncStatus.textContent = `Synced with HTTP headers (offset: ${timeOffset > 0 ? '+' : ''}${Math.round(timeOffset/1000)}s, delay: ${Math.round(networkDelay)}ms)`;
                            syncStatus.className = 'sync-status success';
                        } else {
                            throw new Error('No server time available in headers');
                        }
                    }
                }
                
            } catch (error) {
                console.error('All sync methods failed:', error);
                syncStatus.textContent = 'All sync methods failed. Using local time - check console for details.';
                syncStatus.className = 'sync-status error';
                useServerTime = false;
                timeOffset = 0;
            }
            
            syncButton.textContent = 'Sync Time';
            syncButton.disabled = false;
        }
        function generateSecondBars() {
            const secondBars = document.getElementById('secondBars');
            secondBars.innerHTML = '';
            
            for (let i = 0; i < 60; i++) {
                const bar = document.createElement('div');
                bar.className = 'second-bar';
                
                // Add special classes for markers
                if (i % 15 === 0) {
                    bar.classList.add('hour-marker'); // 12, 3, 6, 9 o'clock
                } else if (i % 5 === 0) {
                    bar.classList.add('minute-marker'); // Every 5 minutes
                }
                
                // Set rotation (6 degrees per second/bar)
                const rotation = i * 6;
                bar.style.transform = `translateX(-50%) rotate(${rotation}deg)`;
                bar.style.setProperty('--rotation', `${rotation}deg`);
                bar.dataset.second = i;
                
                secondBars.appendChild(bar);
            }
        }

        // Generate ambient dots
        function generateAmbientDots() {
            const ambientDots = document.getElementById('ambientDots');
            ambientDots.innerHTML = '';
            
            // Create 12 dots around the inner circle
            for (let i = 0; i < 12; i++) {
                const dot = document.createElement('div');
                dot.className = 'ambient-dot';
                
                const angle = (i * 30) * (Math.PI / 180); // 30 degrees apart
                const radius = 45; // Distance from center
                const x = 50 + (radius * Math.cos(angle - Math.PI/2));
                const y = 50 + (radius * Math.sin(angle - Math.PI/2));
                
                dot.style.left = `${x}%`;
                dot.style.top = `${y}%`;
                dot.style.animationDelay = `${i * 0.25}s`;
                
                ambientDots.appendChild(dot);
            }
        }

        // Update clock display
        function updateClock() {
            const now = getCurrentTime();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const seconds = now.getSeconds();
            
            // Update digital display
            document.getElementById('timeDisplay').textContent = `${hours}:${minutes}`;
            
            // Update date display with timezone info
            const options = { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                timeZone: selectedTimezone === 'local' ? undefined : selectedTimezone
            };
            
            let dateText = now.toLocaleDateString('en-US', options);
            if (selectedTimezone !== 'local') {
                const timezoneDisplay = selectedTimezone === 'UTC' ? 'UTC' : selectedTimezone.split('/')[1]?.replace('_', ' ') || selectedTimezone;
                dateText += ` (${timezoneDisplay})`;
            }
            
            document.getElementById('dateDisplay').textContent = dateText;
            
            // Trigger flip animation on minute change
            if (seconds === 0) {
                triggerFlipAnimation();
            }
            
            // Update second bars with stacking effect
            const bars = document.querySelectorAll('.second-bar');
            bars.forEach((bar, index) => {
                // Remove all classes first
                bar.classList.remove('stacked', 'current');
                
                if (index < seconds) {
                    // All bars before current second are stacked (lit up)
                    bar.classList.add('stacked');
                } else if (index === seconds) {
                    // Current second bar pulses brighter
                    bar.classList.add('current');
                }
                // Bars after current second remain dim (default state)
            });
        }
        
        // Trigger 3D flip animation with complete theme swap
        function triggerFlipAnimation() {
            const clockFace = document.querySelector('.clock-face');
            const body = document.body;
            
            // Start flip animation
            clockFace.classList.add('flipping');
            
            // At the middle of flip (when clock is sideways), toggle complete theme
            setTimeout(() => {
                body.classList.toggle('theme-b');
                
                // Update ambient background colors based on current theme
                const isThemeB = body.classList.contains('theme-b');
                
                if (isThemeB) {
                    // Theme B: Electric Blue and Green
                    document.documentElement.style.setProperty('--ambient-primary', 'rgba(0, 128, 255, 0.08)');
                    document.documentElement.style.setProperty('--ambient-secondary', 'rgba(0, 255, 136, 0.06)');
                    document.documentElement.style.setProperty('--ambient-accent', 'rgba(0, 102, 204, 0.04)');
                } else {
                    // Theme A: Gold and Purple
                    document.documentElement.style.setProperty('--ambient-primary', 'rgba(255, 176, 0, 0.08)');
                    document.documentElement.style.setProperty('--ambient-secondary', 'rgba(139, 63, 247, 0.06)');
                    document.documentElement.style.setProperty('--ambient-accent', 'rgba(255, 215, 0, 0.04)');
                }
            }, 1000); // Half of 2s animation
            
            // Remove flip class after animation completes
            setTimeout(() => {
                clockFace.classList.remove('flipping');
            }, 2000);
        }

        // Initialize clock
        function initClock() {
            generateSecondBars();
            generateAmbientDots();
            updateClock();
            
            // Set up event listeners
            document.getElementById('timezoneSelect').addEventListener('change', function(e) {
                selectedTimezone = e.target.value;
                const syncStatus = document.getElementById('syncStatus');
                
                if (selectedTimezone === 'local') {
                    syncStatus.textContent = 'Using local system time';
                    syncStatus.className = 'sync-status';
                } else {
                    syncStatus.textContent = `Using ${selectedTimezone === 'UTC' ? 'UTC' : e.target.options[e.target.selectedIndex].text} timezone`;
                    syncStatus.className = 'sync-status';
                }
                
                updateClock(); // Immediate update
            });
            
            document.getElementById('syncButton').addEventListener('click', syncTime);
            
            // Update every second
            setInterval(updateClock, 1000);
        }

        // Start clock when page loads
        document.addEventListener('DOMContentLoaded', initClock);
    </script>
    <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
