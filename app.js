/**
 * Kalorijų Skaičiuoklė - Pagrindinė Logika
 */

const app = {
    chartInstance: null,
    historyTimeframe: 7, // Kiek dienų rodyti grafike
    // Duomenų struktūra LocalStorage
    data: {
        profile: {
            gender: 'male',
            age: '',
            height: '',
            weight: '',
            activity: '1.2',
            goal: 0,
            eatBackCalories: true,
            tdee: 0, // Total Daily Energy Expenditure (Poreikis)
            macros: { protein: 0, fat: 0, carbs: 0, fiber: 0 }
        },
        foods: [],
        meals: [], // Sukurti patiekalai/receptai
        consumedToday: {
            date: new Date().toISOString().split('T')[0],
            trainingKcal: 0,
            items: [],
            totalKcal: 0,
            totalProtein: 0,
            totalFat: 0,
            totalCarbs: 0,
            totalFiber: 0
        },
        history: []
    },

    // Laikinoji atmintis kuriant patiekalą
    tempMeal: {
        ingredients: [],
        totalWeight: 0,
        totalKcal: 0,
        totalProtein: 0,
        totalFat: 0,
        totalCarbs: 0,
        totalFiber: 0
    },

    init() {

        this.loadData();
        this.setupNavigation();
        this.setupDate();
        this.setupProfileForm();
        this.setupAddFoodForm();
        this.setupMealForm();
        this.setupConsumeForm();
        this.setupOnlineSearch();

        this.updateProfileUI(); // Atnaujina profilio formos laukus
        this.calculateDailyNeeds(); // Perskaičiuoja normą
        this.renderFoodsList();
        this.renderMealsList();
        this.renderTodayMeals();
        this.renderHistory();
        this.updateSummaryUI(); // Atnaujina suvestinę pagrindiniame lange
    },

    resetApp() {
        if (confirm("Ar tikrai norite ištrinti absoliučiai visus duomenis (istoriją, profilio svorį, patiekalus)?\nTai atstatys aplikaciją į pradinę būseną.")) {
            localStorage.removeItem('kalorijos_db');
            window.location.reload();
        }
    },

    exportData() {
        const dataStr = localStorage.getItem('kalorijos_db');
        if (!dataStr) return alert("Nerasta jokių duomenų išsaugojimui.");
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        a.download = `kalorijos_kopija_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (importedData && importedData.profile) {
                    if (confirm("Ar tikrai norite perrašyti dabartinius duomenis? Aplikacija bus perkrauta.")) {
                        localStorage.setItem('kalorijos_db', JSON.stringify(importedData));
                        window.location.reload();
                    }
                } else {
                    alert("Neatpažintas failo formatas.");
                }
            } catch (err) {
                alert("Klaida skaitant failą.");
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset input
    },

    // --- DUOMENŲ SAUGOJIMAS IR UŽKROVIMAS ---
    saveData() {
        localStorage.setItem('kalorijos_db', JSON.stringify(this.data));
    },

    loadData() {
        const saved = localStorage.getItem('kalorijos_db');
        if (saved) {
            const parsed = JSON.parse(saved);

            // Patikriname ar prasidėjo nauja diena
            const today = new Date().toISOString().split('T')[0];
            if (parsed.consumedToday && parsed.consumedToday.date !== today) {
                // Išsaugome vakarykštę dieną į istoriją, jei buvo veiklos
                if (!parsed.history) parsed.history = [];
                if (parsed.consumedToday.totalKcal > 0 || parsed.consumedToday.steps > 0 || parsed.consumedToday.trainingKcal > 0) {
                    parsed.history.push({
                        date: parsed.consumedToday.date,
                        totalKcal: parsed.consumedToday.totalKcal,
                        totalProtein: parsed.consumedToday.totalProtein,
                        totalFat: parsed.consumedToday.totalFat,
                        totalCarbs: parsed.consumedToday.totalCarbs,
                        trainingKcal: parsed.consumedToday.trainingKcal || 0,
                        tdee: parsed.profile ? parsed.profile.tdee : 0,
                        weight: parsed.profile ? parsed.profile.weight : 0,
                        items: parsed.consumedToday.items || []
                    });
                }

                // Reset dienos suvestinę
                parsed.consumedToday = {
                    date: today,
                    trainingKcal: 0,
                    items: [],
                    totalKcal: 0, totalProtein: 0, totalFat: 0, totalCarbs: 0, totalFiber: 0
                };
            }

            // Atgalinis suderinamumas / Migracija: Skaidulos
            if (parsed.profile && parsed.profile.macros && parsed.profile.macros.fiber === undefined) {
                parsed.profile.macros.fiber = 0;
            }
            if (parsed.consumedToday && parsed.consumedToday.totalFiber === undefined) {
                parsed.consumedToday.totalFiber = 0;
            }
            if (parsed.history) {
                parsed.history = parsed.history.map(h => {
                    if (h.totalFiber === undefined) h.totalFiber = 0;
                    return h;
                });
            }
            if (parsed.foods) {
                parsed.foods = parsed.foods.map(f => {
                    if (f.fiber === undefined) f.fiber = 0;
                    return f;
                });
            }
            if (parsed.meals) {
                parsed.meals = parsed.meals.map(m => {
                    if (m.totalFiber === undefined) m.totalFiber = 0;
                    return m;
                });
            }

            // Atgalinis suderinamumas senesniems išsaugojimams
            if (parsed.profile.eatBackCalories === undefined) parsed.profile.eatBackCalories = true;
            if (parsed.consumedToday && parsed.consumedToday.trainingKcal === undefined) parsed.consumedToday.trainingKcal = 0;
            if (!parsed.history) parsed.history = [];

            this.data = { ...this.data, ...parsed };
        }
    },

    // --- NAVIGACIJA IR UI ---
    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const views = document.querySelectorAll('.view-section');

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                // Nuimti active klasę nuo visų
                navItems.forEach(n => n.classList.remove('active'));
                views.forEach(v => {
                    v.classList.remove('active');
                    v.classList.add('hidden');
                });

                // Uždėti active klasę ant pasirinkto
                item.classList.add('active');
                const targetId = item.getAttribute('data-target');
                const targetView = document.getElementById(targetId);
                targetView.classList.remove('hidden');
                targetView.classList.add('active');

                // Jei atidaroma istorija, perpaišome, kad grafikas atsinaujintų teisingais matmenimis
                if (targetId === 'view-history') {
                    this.renderHistory();
                }
            });
        });
    },

    setupDate() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        let dateStr = new Date().toLocaleDateString('lt-LT', options);
        // Padaryti pirmą raidę didžiąją
        dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
        document.getElementById('currentDate').innerText = dateStr;
    },

    // --- MODALŲ VALDYMAS ---
    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    },

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    },

    closeMealModal() {
        this.closeModal('addMealModal');
        // Resetiname visą patiekalo formos būseną
        this.editingMealId = null;
        this.tempMeal = { ingredients: [], totalWeight: 0, totalKcal: 0, totalProtein: 0, totalFat: 0, totalCarbs: 0 };
        document.getElementById('mealName').value = '';
        document.getElementById('mealTotalWeight').innerText = '0';
        document.getElementById('mealTotalKcal').innerText = '0';
        document.getElementById('saveMealBtn').innerText = 'Išsaugoti patiekalą';
        document.getElementById('addMealModal').querySelector('h2').innerText = 'Kurti Patiekalą';
        this.renderTempIngredients();
    },

    // --- PROFILIS IR SKAIČIAVIMAI ---
    setupProfileForm() {
        const form = document.getElementById('profileForm');

        // Funkcija, kuri paima duomenis ir perskaičiuoja
        const updateAndCalculate = () => {
            this.data.profile.gender = document.getElementById('gender').value;
            this.data.profile.age = parseFloat(document.getElementById('age').value) || 0;
            this.data.profile.height = parseFloat(document.getElementById('height').value) || 0;
            this.data.profile.weight = parseFloat(document.getElementById('weight').value.replace(',', '.')) || 0;
            this.data.profile.activity = parseFloat(document.getElementById('activity').value) || 1.2;
            this.data.profile.goal = parseFloat(document.getElementById('goal').value) || 0;

            const eatBackSel = document.getElementById('eatBackCalories');
            if (eatBackSel) {
                this.data.profile.eatBackCalories = eatBackSel.value === 'true';
            }

            this.calculateDailyNeeds();
        };

        // Skaičiuojam realiu laiku, kai vartotojas kažką keičia (ne tik paspaudus mygtuką)
        form.addEventListener('input', updateAndCalculate);
        form.addEventListener('change', updateAndCalculate);

        // Paspaudus saugoti mygtuką - tiesiog išsaugome į LocalStorage
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            updateAndCalculate();
            this.saveData();

            // Pasirenkame mygtuką, kad parodytume animaciją
            const btn = form.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            btn.innerText = 'Išsaugota! ✓';
            btn.style.backgroundColor = 'var(--success)';

            setTimeout(() => {
                btn.innerText = originalText;
                btn.style.backgroundColor = '';
            }, 2000);
        });
    },

    updateProfileUI() {
        const p = this.data.profile;
        document.getElementById('gender').value = p.gender;
        document.getElementById('age').value = p.age;
        document.getElementById('height').value = p.height;
        document.getElementById('weight').value = p.weight;
        document.getElementById('activity').value = p.activity;
        document.getElementById('goal').value = p.goal;
        if (document.getElementById('eatBackCalories')) {
            document.getElementById('eatBackCalories').value = p.eatBackCalories === false ? 'false' : 'true';
        }
    },

    calculateDailyNeeds() {
        const p = this.data.profile;
        if (!p.age || !p.height || !p.weight) return;

        // Mifflin-St Jeor lygtis BMR (Basal Metabolic Rate)
        let bmr = (10 * p.weight) + (6.25 * p.height) - (5 * p.age);
        if (p.gender === 'male') {
            bmr += 5;
        } else {
            bmr -= 161;
        }

        // TDEE (Total Daily Energy Expenditure)
        let tdee = bmr * p.activity;

        // Pridedame tikslą (deficiting/surplus)
        let targetKcal = Math.round(tdee + p.goal);

        // Saugiklis, kad nenukristų per žemai
        if (p.gender === 'male' && targetKcal < 1500) targetKcal = 1500;
        if (p.gender === 'female' && targetKcal < 1200) targetKcal = 1200;

        // Makrokomponentai (Subalansuota, % nuo normos): 
        // Baltymai: 30% (4 kcal/g)
        // Riebalai: 30% (9 kcal/g)
        // Angliavandeniai: 40% (4 kcal/g)
        const protein = Math.round((targetKcal * 0.30) / 4);
        const fat = Math.round((targetKcal * 0.30) / 9);
        const carbs = Math.round((targetKcal * 0.40) / 4);
        const fiber = Math.round((targetKcal / 1000) * 14); // 14g skaidulų kiekvienam 1000 kcal

        p.tdee = targetKcal;
        p.macros = { protein, fat, carbs, fiber };

        document.getElementById('profileTDEE').innerText = p.tdee;
        this.updateSummaryUI();
    },

    // --- SUVESTINĖS ATNAUJINIMAS ---
    updateSummaryUI() {
        const p = this.data.profile;
        const c = this.data.consumedToday;

        // Išsaugome tiesiai iš vartotojo įvestas treniruočių kcal
        const burnedKcal = c.trainingKcal || 0;

        document.getElementById('burnedKcal').innerText = Math.round(burnedKcal);
        document.getElementById('todayTraining').value = burnedKcal === 0 ? '' : burnedKcal;

        // Dinaminė norma = bazinis tdee + ką sudegino - ką suvalgė 
        // ARBA tik bazinis tdee - ką suvalgė (jei vartotojas nenori pridėti sudegintų kalorijų)
        const eatBack = p.eatBackCalories !== false; // Default true if undefined
        const dynamicTDEE = eatBack ? p.tdee + burnedKcal : p.tdee;

        const remaining = dynamicTDEE - c.totalKcal;
        document.getElementById('caloriesRemaining').innerText = Math.round(remaining >= 0 ? remaining : 0);

        // Atnaujinam naujus teksto elementus suvestinėje
        const consumedDisplay = document.getElementById('caloriesConsumed');
        if (consumedDisplay) consumedDisplay.innerText = Math.round(c.totalKcal);

        const burnedTotalDisplay = document.getElementById('caloriesBurnedTotal');
        if (burnedTotalDisplay) burnedTotalDisplay.innerText = Math.round(burnedKcal);

        const baseGoalDisplay = document.getElementById('summaryBaseGoal');
        if (baseGoalDisplay) baseGoalDisplay.innerText = Math.round(p.tdee);

        const maintGoalDisplay = document.getElementById('summaryMaintenanceGoal');
        if (maintGoalDisplay) maintGoalDisplay.innerText = Math.round(p.tdee - (p.goal || 0));

        const bonusWrapper = document.getElementById('summaryBonus');
        const bonusValue = document.getElementById('summaryBonusValue');
        if (bonusWrapper && bonusValue) {
            if (eatBack && burnedKcal > 0) {
                bonusWrapper.style.display = 'inline';
                bonusValue.innerText = Math.round(burnedKcal);
            } else {
                bonusWrapper.style.display = 'none';
            }
        }

        // Atnaujinam tekstus
        document.getElementById('proteinEaten').innerText = Math.round(c.totalProtein);
        document.getElementById('proteinGoal').innerText = p.macros.protein;

        document.getElementById('fatEaten').innerText = Math.round(c.totalFat);
        document.getElementById('fatGoal').innerText = p.macros.fat;

        document.getElementById('carbsEaten').innerText = Math.round(c.totalCarbs);
        document.getElementById('carbsGoal').innerText = p.macros.carbs;

        document.getElementById('fiberEaten').innerText = Math.round(c.totalFiber || 0);
        document.getElementById('fiberGoal').innerText = p.macros.fiber || 0;

        // Atnaujinam progress bar'us
        const pPercent = p.macros.protein ? Math.min((c.totalProtein / p.macros.protein) * 100, 100) : 0;
        const fPercent = p.macros.fat ? Math.min((c.totalFat / p.macros.fat) * 100, 100) : 0;
        const cPercent = p.macros.carbs ? Math.min((c.totalCarbs / p.macros.carbs) * 100, 100) : 0;
        const fibPercent = p.macros.fiber ? Math.min(((c.totalFiber || 0) / p.macros.fiber) * 100, 100) : 0;

        document.querySelector('.protein-fill').style.width = `${pPercent}%`;
        document.querySelector('.fat-fill').style.width = `${fPercent}%`;
        document.querySelector('.carbs-fill').style.width = `${cPercent}%`;
        const fibFill = document.querySelector('.fiber-fill');
        if (fibFill) fibFill.style.width = `${fibPercent}%`;

        // Progress circle (Circular progress)
        const circle = document.querySelector('.circular-progress');
        const calPercent = dynamicTDEE ? Math.min((c.totalKcal / dynamicTDEE) * 100, 100) : 0;
        circle.style.background = `conic-gradient(var(--primary) ${calPercent}%, rgba(255,255,255,0.05) 0%)`;

        if (calPercent >= 100) {
            circle.style.background = `conic-gradient(var(--danger) ${calPercent}%, rgba(255,255,255,0.05) 0%)`;
        }
    },

    updateTrainingKcal() {
        const input = document.getElementById('todayTraining');
        const cal = parseInt(input.value) || 0;

        this.data.consumedToday.trainingKcal = cal;
        this.saveData();
        this.updateSummaryUI();

        const btn = document.querySelector('.steps-card .btn');
        if (btn) {
            const originalText = btn.innerText;
            btn.innerText = 'Išsaugota! ✓';
            btn.style.backgroundColor = 'var(--success)';

            setTimeout(() => {
                btn.innerText = originalText;
                btn.style.backgroundColor = '';
            }, 2000);
        }
    },

    deleteFood(id) {
        if (!confirm('Ar tikrai norite ištrinti šį produktą?')) return;
        this.data.foods = this.data.foods.filter(f => f.id !== id);
        this.saveData();
        this.renderFoodsList();
        this.updateIngredientSelect();
    },

    deleteMeal(id) {
        if (!confirm('Ar tikrai norite ištrinti šį patiekalą?')) return;
        this.data.meals = this.data.meals.filter(m => m.id !== id);
        this.saveData();
        this.renderMealsList();
    },

    deleteConsumedItem(id) {
        if (!confirm('Ar tikrai norite pašalinti šį įrašą?')) return;
        const item = this.data.consumedToday.items.find(i => i.id === id);
        if (item) {
            this.data.consumedToday.totalKcal -= item.kcal;
            this.data.consumedToday.totalProtein -= item.protein;
            this.data.consumedToday.totalFat -= item.fat;
            this.data.consumedToday.totalCarbs -= item.carbs;
            this.data.consumedToday.totalFiber -= (item.fiber || 0);
            this.data.consumedToday.items = this.data.consumedToday.items.filter(i => i.id !== id);
            this.saveData();
            this.updateSummaryUI();
            this.renderTodayMeals();
        }
    },

    // --- PRODUKTŲ VALDYMAS ---
    setupAddFoodForm() {
        this.editingFoodId = null;
        const form = document.getElementById('addProductForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const unit = document.getElementById('newFoodUnit')?.value || 'g';
            const foodData = {
                name: document.getElementById('newFoodName').value,
                unit: unit,
                weightPerUnit: unit === 'vnt' ? (parseFloat(document.getElementById('newFoodWeightPerUnit').value.replace(',', '.')) || 0) : 0,
                kcal: parseFloat(document.getElementById('newFoodKcal').value.replace(',', '.')),
                protein: parseFloat(document.getElementById('newFoodProtein').value.replace(',', '.')),
                fat: parseFloat(document.getElementById('newFoodFat').value.replace(',', '.')),
                carbs: parseFloat(document.getElementById('newFoodCarbs').value.replace(',', '.')),
                fiber: parseFloat(document.getElementById('newFoodFiber').value.replace(',', '.')) || 0
            };

            if (this.editingFoodId !== null) {
                const idx = this.data.foods.findIndex(f => f.id === this.editingFoodId);
                if (idx !== -1) {
                    this.data.foods[idx] = { id: this.editingFoodId, ...foodData };
                }
                this.editingFoodId = null;
            } else {
                const newFood = {
                    id: Date.now() + Math.floor(Math.random() * 10000),
                    ...foodData
                };
                this.data.foods.push(newFood);
            }

            this.saveData();
            this.renderFoodsList();
            // Atnaujinti produktų iškrentantį sąrašą
            this.updateIngredientSelect();
            this.closeModal('addProductModal');
            form.reset();
            // Slėpti weightPerUnit lauką po reset
            const wpuGroup = document.getElementById('weightPerUnitGroup');
            if (wpuGroup) wpuGroup.style.display = 'none';
        });

        // Search functionality
        document.getElementById('foodSearch').addEventListener('input', (e) => {
            this.renderFoodsList(e.target.value);
        });
    },

    openAddFoodModal() {
        this.editingFoodId = null;
        document.getElementById('addProductForm').reset();
        document.getElementById('addProductModal').querySelector('h2').innerText = 'Naujas Produktas';
        document.getElementById('addProductModal').querySelector('button[type="submit"]').innerText = 'Išsaugoti produktą';
        const wpuGroup = document.getElementById('weightPerUnitGroup');
        if (wpuGroup) wpuGroup.style.display = 'none';
        this.showModal('addProductModal');
    },

    editFood(id) {
        const food = this.data.foods.find(f => f.id === id);
        if (!food) return;

        this.editingFoodId = id;
        document.getElementById('newFoodName').value = food.name;
        document.getElementById('newFoodUnit').value = food.unit || 'g';

        const wpuGroup = document.getElementById('weightPerUnitGroup');
        if (wpuGroup) wpuGroup.style.display = (food.unit === 'vnt') ? 'block' : 'none';

        document.getElementById('newFoodWeightPerUnit').value = food.weightPerUnit || '';
        document.getElementById('newFoodKcal').value = food.kcal;
        document.getElementById('newFoodProtein').value = food.protein;
        document.getElementById('newFoodFat').value = food.fat;
        document.getElementById('newFoodCarbs').value = food.carbs;
        document.getElementById('newFoodFiber').value = food.fiber || 0;

        document.getElementById('addProductModal').querySelector('h2').innerText = 'Redaguoti Produktą';
        document.getElementById('addProductModal').querySelector('button[type="submit"]').innerText = 'Išsaugoti pakeitimus';

        this.showModal('addProductModal');
    },

    onFoodUnitChange() {
        const unit = document.getElementById('newFoodUnit')?.value;
        const group = document.getElementById('weightPerUnitGroup');
        if (group) group.style.display = (unit === 'vnt') ? 'block' : 'none';
    },

    renderFoodsList(filterText = '') {
        const list = document.getElementById('foodsList');
        list.innerHTML = '';

        const filtered = this.data.foods.filter(f =>
            f.name.toLowerCase().includes(filterText.toLowerCase())
        );

        if (filtered.length === 0) {
            list.innerHTML = '<li class="empty-state">Produktų nerasta.</li>';
            return;
        }

        filtered.forEach(food => {
            const li = document.createElement('li');
            li.className = 'glass-card mt-10';
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.innerHTML = `
                <div>
                    <strong>${food.name}</strong>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                        ${food.unit === 'vnt' ? `1 vnt` : `100${food.unit || 'g'}`}: ${food.kcal} kcal | B: ${food.protein}g | R: ${food.fat}g | A: ${food.carbs}g | S: ${food.fiber || 0}g
                    </div>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button class="icon-btn" onclick="app.editFood(${food.id})" title="Redaguoti">
                        <span class="material-icons-round" style="color: var(--primary)">edit</span>
                    </button>
                    <button class="icon-btn" onclick="app.deleteFood(${food.id})" title="Ištrinti">
                        <span class="material-icons-round" style="color: var(--danger)">delete</span>
                    </button>
                    <button class="icon-btn" onclick="app.openConsumeModal(${food.id}, 'food')" title="Valgyti">
                        <span class="material-icons-round" style="color: var(--success)">add_circle</span>
                    </button>
                </div>
            `;
            list.appendChild(li);
        });
    },

    // --- PATIEKALŲ KŪRIMAS ---
    setupMealForm() {
        this.updateIngredientSelect();
        this.editingMealId = null; // null = naujas, number = redaguojamas

        // Paieškos funkcionalumas patiekalams
        const mealSearchInput = document.getElementById('mealSearch');
        if (mealSearchInput) {
            mealSearchInput.addEventListener('input', (e) => {
                this.renderMealsList(e.target.value);
            });
        }

        const form = document.getElementById('addMealForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.tempMeal.ingredients.length === 0) return alert('Pridėkite bent vieną ingredientą!');

            if (this.editingMealId !== null) {
                // Redagavimo režimas - randame ir pakeičiame esamą patiekalą
                const idx = this.data.meals.findIndex(m => m.id === this.editingMealId);
                if (idx !== -1) {
                    this.data.meals[idx] = {
                        id: this.editingMealId,
                        name: document.getElementById('mealName').value,
                        ingredients: [...this.tempMeal.ingredients],
                        totalWeight: this.tempMeal.totalWeight,
                        kcal: this.tempMeal.totalKcal,
                        protein: this.tempMeal.totalProtein,
                        fat: this.tempMeal.totalFat,
                        carbs: this.tempMeal.totalCarbs
                    };
                }
                this.editingMealId = null;
            } else {
                // Naujas patiekalas
                const newMeal = {
                    id: Date.now() + Math.floor(Math.random() * 10000),
                    name: document.getElementById('mealName').value,
                    ingredients: [...this.tempMeal.ingredients],
                    totalWeight: this.tempMeal.totalWeight,
                    kcal: this.tempMeal.totalKcal,
                    protein: this.tempMeal.totalProtein,
                    fat: this.tempMeal.totalFat,
                    carbs: this.tempMeal.totalCarbs,
                    fiber: this.tempMeal.totalFiber
                };
                this.data.meals.push(newMeal);
            }

            this.saveData();
            this.renderMealsList();
            this.closeModal('addMealModal');
            document.getElementById('addMealModal').querySelector('h2').innerText = 'Kurti Patiekalą';
            document.getElementById('saveMealBtn').innerText = 'Išsaugoti patiekalą';

            // Atstatom laikinąjį
            this.tempMeal = { ingredients: [], totalWeight: 0, totalKcal: 0, totalProtein: 0, totalFat: 0, totalCarbs: 0 };
            document.getElementById('mealName').value = '';
            this.renderTempIngredients();
        });
    },

    updateIngredientSelect() {
        const datalist = document.getElementById('ingredientOptions');
        if (!datalist) return;
        datalist.innerHTML = '';
        // Surūšiuojam abėcėlės tvarka
        const sortedFoods = [...this.data.foods].sort((a, b) => a.name.localeCompare(b.name));
        sortedFoods.forEach(food => {
            const option = document.createElement('option');
            option.value = food.name;
            datalist.appendChild(option);
        });
    },

    editMeal(id) {
        const meal = this.data.meals.find(m => m.id === id);
        if (!meal) return;

        this.editingMealId = id;

        // Užpildome laikinus duomenis esamo patiekalo reikšmėmis
        this.tempMeal = {
            ingredients: [...meal.ingredients],
            totalWeight: meal.totalWeight,
            totalKcal: meal.kcal,
            totalProtein: meal.protein,
            totalFat: meal.fat,
            totalCarbs: meal.carbs
        };

        // Atnaujinami sumų rodiniai
        document.getElementById('mealTotalWeight').innerText = Math.round(meal.totalWeight);
        document.getElementById('mealTotalKcal').innerText = Math.round(meal.kcal);

        // Užpildome patiekalo pavadinimą
        document.getElementById('mealName').value = meal.name;

        // Pakeičiame modalinio lango antraštę ir mygtuko tekstą
        document.getElementById('addMealModal').querySelector('h2').innerText = 'Redaguoti Patiekalą';
        document.getElementById('saveMealBtn').innerText = 'Išsaugoti pakeitimus';

        // Atvaizduojam ingredientus
        this.renderTempIngredients();
        this.calculateTempMeal();

        // Atidarom modalą
        this.showModal('addMealModal');
    },

    addIngredientToMeal() {
        const inputStr = document.getElementById('ingredientInput').value.trim();
        const weightInput = document.getElementById('ingredientWeight');
        const unitSelect = document.getElementById('ingredientUnit');

        const amount = parseFloat(weightInput.value.replace(',', '.'));
        const unitValue = unitSelect.value; // gali būti "vnt" arba skaičius
        const isVnt = unitValue === 'vnt';

        if (!inputStr || !amount || amount <= 0) {
            return alert('Pasirinkite produktą ir įveskite kiekį!');
        }

        const food = this.data.foods.find(f => f.name === inputStr);
        if (!food) return alert('Toks produktas nerastas. Pasirinkite iš sąrašo!');

        if (!isVnt) {
            const unitMultiplierNum = parseFloat(unitValue) || 1;
            const weightInGrams = amount * unitMultiplierNum;
            const ratio = weightInGrams / 100;
            const displayAmountStr = `${amount} ${unitSelect.options[unitSelect.selectedIndex].text}`;

            const ingItem = {
                id: Date.now() + Math.floor(Math.random() * 10000),
                foodId: food.id,
                name: food.name,
                weight: weightInGrams,
                displayAmount: displayAmountStr,
                kcal: (food.kcal * ratio),
                protein: (food.protein * ratio),
                fat: (food.fat * ratio),
                carbs: (food.carbs * ratio)
            };
            this.tempMeal.ingredients.push(ingItem);
        } else {
            // vnt produktas: kalorijos = kcal_per_unit × kiekis
            const weightInGrams = amount * (food.weightPerUnit || 0);
            const displayAmountStr = `${amount} vnt`;

            const ingItem = {
                id: Date.now() + Math.floor(Math.random() * 10000),
                foodId: food.id,
                name: food.name,
                weight: weightInGrams,
                displayAmount: displayAmountStr,
                kcal: food.kcal * amount,
                protein: food.protein * amount,
                fat: food.fat * amount,
                carbs: food.carbs * amount,
                fiber: (food.fiber || 0) * amount
            };
            this.tempMeal.ingredients.push(ingItem);
        }
        this.calculateTempMeal();
        this.renderTempIngredients();

        // Išvalom formą
        document.getElementById('ingredientInput').value = '';
        weightInput.value = '';
    },

    removeTempIngredient(id) {
        this.tempMeal.ingredients = this.tempMeal.ingredients.filter(i => i.id !== id);
        this.calculateTempMeal();
        this.renderTempIngredients();
    },

    calculateTempMeal() {
        let weight = 0, kcal = 0, protein = 0, fat = 0, carbs = 0, fiber = 0;

        this.tempMeal.ingredients.forEach(i => {
            weight += i.weight;
            kcal += i.kcal;
            protein += i.protein;
            fat += i.fat;
            carbs += i.carbs;
            fiber += i.fiber;
        });

        this.tempMeal.totalWeight = weight;
        this.tempMeal.totalKcal = kcal;
        this.tempMeal.totalProtein = protein;
        this.tempMeal.totalFat = fat;
        this.tempMeal.totalCarbs = carbs;
        this.tempMeal.totalFiber = fiber;

        document.getElementById('mealTotalWeight').innerText = Math.round(weight);
        document.getElementById('mealTotalKcal').innerText = Math.round(kcal);

        const btn = document.getElementById('saveMealBtn');
        btn.disabled = this.tempMeal.ingredients.length === 0;
    },

    renderTempIngredients() {
        const list = document.getElementById('mealIngredientsList');
        list.innerHTML = '';

        if (this.tempMeal.ingredients.length === 0) {
            list.innerHTML = '<li class="empty-state" style="padding: 5px; font-size: 12px;">Kol kas ingredientų nėra.</li>';
            return;
        }

        this.tempMeal.ingredients.forEach(i => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.borderBottom = '1px solid var(--glass-border)';
            li.style.padding = '5px 0';
            li.style.fontSize = '14px';

            li.innerHTML = `
                <div>${i.name} (${i.displayAmount || Math.round(i.weight) + 'g'})</div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="color: var(--text-muted); font-size: 12px;">${Math.round(i.kcal)} kcal</span>
                    <button type="button" class="icon-btn" style="padding: 2px; color: var(--danger)" onclick="app.removeTempIngredient(${i.id})">
                        <span class="material-icons-round" style="font-size: 18px;">delete</span>
                    </button>
                </div>
            `;
            list.appendChild(li);
        });
    },

    renderMealsList(filterText = '') {
        const list = document.getElementById('mealsList');
        list.innerHTML = '';

        const filtered = this.data.meals.filter(m =>
            m.name.toLowerCase().includes(filterText.toLowerCase())
        );

        if (filtered.length === 0) {
            list.innerHTML = `<li class="empty-state">${filterText ? 'Patiekalų nerasta.' : 'Jūs dar nesukūrėte jokių patiekalų.'}</li>`;
            return;
        }

        filtered.forEach(meal => {
            const li = document.createElement('li');
            li.className = 'glass-card mt-10';
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';

            // Kiek 100g gaunasi kalorijų ir makroelementų?
            const kcalPer100 = meal.totalWeight > 0 ? (meal.kcal / meal.totalWeight) * 100 : 0;
            const protPer100 = meal.totalWeight > 0 ? ((meal.protein || meal.totalProtein || 0) / meal.totalWeight) * 100 : 0;
            const fatPer100 = meal.totalWeight > 0 ? ((meal.fat || meal.totalFat || 0) / meal.totalWeight) * 100 : 0;
            const carbPer100 = meal.totalWeight > 0 ? ((meal.carbs || meal.totalCarbs || 0) / meal.totalWeight) * 100 : 0;
            const fiberPer100 = meal.totalWeight > 0 ? ((meal.fiber || meal.totalFiber || 0) / meal.totalWeight) * 100 : 0;

            li.innerHTML = `
                <div>
                    <strong>${meal.name}</strong>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                        Visas svoris: ${Math.round(meal.totalWeight)}g | Viso: ${Math.round(meal.kcal)} kcal<br>
                        <em>100g: ~${Math.round(kcalPer100)} kcal | B: ${protPer100.toFixed(1)}g | R: ${fatPer100.toFixed(1)}g | A: ${carbPer100.toFixed(1)}g | S: ${fiberPer100.toFixed(1)}g</em>
                    </div>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button class="icon-btn" onclick="app.editMeal(${meal.id})" title="Redaguoti">
                        <span class="material-icons-round" style="color: var(--primary)">edit</span>
                    </button>
                    <button class="icon-btn" onclick="app.deleteMeal(${meal.id})" title="Ištrinti">
                        <span class="material-icons-round" style="color: var(--danger)">delete</span>
                    </button>
                    <button class="icon-btn" onclick="app.openConsumeModal(${meal.id}, 'meal')" title="Valgyti">
                        <span class="material-icons-round" style="color: var(--success)">add_circle</span>
                    </button>
                </div>
`;
            list.appendChild(li);
        });
    },

    // --- MAISTO SUVARTOJIMAS (FIKSAVIMAS) ---
    openConsumeModal(id, type) {
        let item = null;
        let kcalRatio = 0; // Kiek kalorijų viename grame
        let isVnt = false;

        if (type === 'food') {
            item = this.data.foods.find(f => f.id === id);
            if (item) {
                if (item.unit === 'vnt') {
                    isVnt = true;
                    kcalRatio = item.kcal;
                } else {
                    kcalRatio = item.kcal / 100;
                }
            }
        } else {
            item = this.data.meals.find(m => m.id === id);
            if (item) kcalRatio = item.kcal / item.totalWeight;
        }

        if (!item) return;

        document.getElementById('consumeModalTitle').innerText = item.name;
        document.getElementById('consumeItemId').value = id;
        document.getElementById('consumeItemType').value = type;

        const weightInput = document.getElementById('consumeWeight');
        const unitSelect = document.getElementById('consumeUnit');

        // Padarome 'vnt' parinktį matoma/nematoma priklausomai nuo to ar tai food'as su unit='vnt' (leidžiame patiekalams rodyti tik gramus/porcijas ir pan)
        const vntOption = unitSelect.querySelector('option[value="vnt"]');
        if (vntOption) {
            vntOption.style.display = isVnt ? 'block' : 'none';
        }

        weightInput.value = '';
        unitSelect.value = isVnt ? 'vnt' : '1';
        const calcSpan = document.getElementById('consumeCalcKcal');
        calcSpan.innerText = '0';

        // Dinaminis skaičiavimas rašant
        const calculateLive = () => {
            const amount = parseFloat(weightInput.value.replace(',', '.')) || 0;
            const unitVal = unitSelect.value;
            let finalKcal = 0;

            if (unitVal === 'vnt') {
                finalKcal = amount * item.kcal;
            } else {
                const multiplier = parseFloat(unitVal) || 1;
                const finalGrams = amount * multiplier;

                if (type === 'food' && item.unit === 'vnt') {
                    const wpu = item.weightPerUnit || 1;
                    const ratio = finalGrams / wpu;
                    finalKcal = ratio * item.kcal;
                } else {
                    finalKcal = finalGrams * kcalRatio;
                }
            }
            calcSpan.innerText = Math.round(finalKcal);
        };

        weightInput.oninput = calculateLive;
        unitSelect.onchange = calculateLive;

        this.showModal('consumeModal');
        setTimeout(() => weightInput.focus(), 100);
    },

    setupConsumeForm() {
        const form = document.getElementById('consumeForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const id = parseInt(document.getElementById('consumeItemId').value);
            const type = document.getElementById('consumeItemType').value;
            const amount = parseFloat(document.getElementById('consumeWeight').value.replace(',', '.'));
            const unitSelect = document.getElementById('consumeUnit');
            const unitVal = unitSelect.value;
            const isVnt = unitVal === 'vnt';
            const multiplier = parseFloat(unitVal) || 1;

            if (!amount || amount <= 0) return;

            // Racionalus sprendimas: Paimame product's original info and apply ratios properly
            let sourceItem = null;
            let consumed = {
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' })
            };
            let ratio = 0;
            let weightInGrams = 0;

            if (type === 'food') {
                sourceItem = this.data.foods.find(f => f.id === id);
                if (sourceItem) {
                    if (isVnt) {
                        ratio = amount;
                        weightInGrams = amount * (sourceItem.weightPerUnit || 0); // Svoris nėra privalomas, tik info
                    } else {
                        weightInGrams = amount * multiplier;
                        if (sourceItem.unit === 'vnt') {
                            const wpu = sourceItem.weightPerUnit || 1; // vengiam 0 per klaidą
                            ratio = weightInGrams / wpu;
                        } else {
                            ratio = weightInGrams / 100;
                        }
                    }
                }
            } else {
                sourceItem = this.data.meals.find(m => m.id === id);
                if (sourceItem) {
                    weightInGrams = amount * multiplier;
                    ratio = weightInGrams / sourceItem.totalWeight;
                }
            }

            if (!sourceItem) return;

            // Gražiai suformatuojam "X vnt" ar "X g"
            let displayAmountStr = '';
            if (isVnt) {
                displayAmountStr = `${amount} vnt`;
            } else {
                displayAmountStr = `${amount} ${unitSelect.options[unitSelect.selectedIndex].text.split(' ')[0]}`;
                // prirašom kiek susidarė gramų, jei ne gramai ir ne ml
                if (unitVal !== '1') displayAmountStr += ` (${Math.round(weightInGrams)}g)`;
            }

            consumed.weight = weightInGrams;
            consumed.displayAmount = displayAmountStr;
            consumed.name = sourceItem.name;
            consumed.type = type;
            consumed.kcal = sourceItem.kcal * ratio;
            consumed.protein = sourceItem.protein * ratio;
            consumed.fat = sourceItem.fat * ratio;
            consumed.carbs = sourceItem.carbs * ratio;
            consumed.fiber = (sourceItem.fiber || 0) * ratio;

            // Pridedam į dienos suvestinę
            const cT = this.data.consumedToday;
            cT.items.push(consumed);
            cT.totalKcal += consumed.kcal;
            cT.totalProtein += consumed.protein;
            cT.totalFat += consumed.fat;
            cT.totalCarbs += consumed.carbs;
            cT.totalFiber += (consumed.fiber || 0);

            this.saveData();
            this.updateSummaryUI();
            this.renderTodayMeals();
            this.closeModal('consumeModal');

            // Jingle ar animacija galėtų būti čia
            // alert('Skanaus!');

            // Gražinam į Suvestinės tabą
            document.querySelector('.nav-item[data-target="view-summary"]').click();
        });
    },

    renderTodayMeals() {
        const list = document.getElementById('todayMealsList');
        list.innerHTML = '';

        const items = this.data.consumedToday.items;

        if (items.length === 0) {
            list.innerHTML = '<li class="empty-state">Dar nieko nesuvalgėte.</li>';
            return;
        }

        // Rodome nuo naujausio
        [...items].reverse().forEach(item => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.borderBottom = '1px solid var(--glass-border)';
            li.style.padding = '10px 0';

            li.innerHTML = `
                <div>
                    <strong style="color: var(--text-main)">${item.name}</strong>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                        ${item.displayAmount || item.weight + 'g'} | ${item.timestamp}
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px; text-align: right;">
                    <div>
                        <div style="font-weight: 600; color: var(--primary)">${Math.round(item.kcal)} kcal</div>
                        <div style="font-size: 10px; color: var(--text-muted)">
                            B:${Math.round(item.protein)} R:${Math.round(item.fat)} A:${Math.round(item.carbs)} S:${Math.round(item.fiber || 0)}
                        </div>
                    </div>
                    <button class="icon-btn" onclick="app.deleteConsumedItem(${item.id})" title="Pašalinti">
                        <span class="material-icons-round" style="color: var(--danger); font-size: 18px;">cancel</span>
                    </button>
                </div>
            `;
            list.appendChild(li);
        });
    },

    // --- ISTORIJA IR PROGRESAS ---
    saveWeightHistory() {
        const input = document.getElementById('historyWeightInput');
        const weight = parseFloat(input.value.replace(',', '.'));
        if (!weight || weight < 30) return alert('Įveskite teisingą svorį!');

        // Skaičiuojame skirtumą nuo senojo svorio
        const oldWeight = this.data.profile.weight || 0;
        const diff = weight - oldWeight;

        // Atnaujinam profilį
        this.data.profile.weight = weight;

        this.saveData();
        this.updateProfileUI();
        this.calculateDailyNeeds();

        input.value = '';

        const wDisplay = document.getElementById('currentWeightDisplay');
        if (wDisplay) wDisplay.innerText = weight;

        // Atvaizduojame skirtumą UI
        const msgDiv = document.getElementById('weightDiffMessage');
        if (msgDiv) {
            msgDiv.style.display = 'block';
            if (Math.abs(diff) < 0.01) {
                msgDiv.innerHTML = '<span style="color: var(--text-muted)">Išsaugota (Nepakito)</span>';
            } else if (diff < 0) {
                msgDiv.innerHTML = `<span style="color: var(--success); font-weight: bold;">Išsaugota! ${diff.toFixed(1)} kg</span>`;
            } else {
                msgDiv.innerHTML = `<span style="color: var(--danger); font-weight: bold;">Išsaugota! +${diff.toFixed(1)} kg</span>`;
            }

            setTimeout(() => {
                msgDiv.style.display = 'none';
            }, 4000);
        }

        const btn = document.querySelector('#view-history .btn-primary');
        if (btn) {
            const originTxt = btn.innerText;
            btn.innerText = 'Išsaugota! ✓';
            btn.style.backgroundColor = 'var(--success)';
            setTimeout(() => {
                btn.innerText = originTxt;
                btn.style.backgroundColor = '';
            }, 2000);
        }
    },

    setHistoryTimeframe(days) {
        this.historyTimeframe = days;

        // Atnaujinti mygtukų stilius
        document.querySelectorAll('.timeframe-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`tf-${days}`);
        if (activeBtn) activeBtn.classList.add('active');

        this.renderHistory();
    },

    renderHistory() {
        const wDisplay = document.getElementById('currentWeightDisplay');
        if (wDisplay) wDisplay.innerText = this.data.profile.weight || 0;

        // Išvalome vidurkį ir balansą jei nėra istorijos
        const d7Kcal = document.getElementById('avg7dKcal');
        const d7Training = document.getElementById('avg7dTraining');
        const weeklyBal = document.getElementById('weeklyBalance');
        const avgDaysText = document.getElementById('avgDaysText');

        if (d7Kcal) d7Kcal.innerText = '0';
        if (d7Training) d7Training.innerText = '0';
        if (avgDaysText) avgDaysText.innerText = this.historyTimeframe;

        if (weeklyBal) {
            weeklyBal.innerText = '0';
            weeklyBal.style.color = 'var(--text-main)';
        }

        if (!this.data.history || this.data.history.length === 0) {
            this.renderHistoryChart([]);
            return;
        }

        // Imame tik pasirinktą dienų kiekį (iš galo, t.y. naujausias dienas)
        const periodData = this.data.history.slice(-this.historyTimeframe);

        let sumKcal = 0;
        let sumTraining = 0;
        let periodBalanceKcal = 0;

        periodData.forEach(r => {
            sumKcal += (r.totalKcal || 0);
            sumTraining += (r.trainingKcal || 0);

            // Treniruočių Kcal priedas
            const burnedKcal = r.trainingKcal || 0;

            // ISTORINIS TDEE jau turi įskaičiuotą tikslą (pvz. -500). 
            // Kad gautume TIKRĄJĮ deficitą (sutaupytas kalorijas nuo PALAIKYMO normos),
            // Mes "nuimame" dabartinį tikslą atgaline data (r.tdee - this.data.profile.goal).
            // Taip gausime kalorijas, kurias vartotojas sudegina per dieną (BMR * Activity).
            const maintenanceTDEE = r.tdee - (this.data.profile.goal || 0);

            let dynamicMaintenanceTDEE = maintenanceTDEE;
            // Jei vartotojas prideda sporto kalorijas prie normos, vadinasi jos irgi padidina jo 
            // dienos išeikvojimą ir leidžia suvalgyti daugiau neprarandant deficito dalies.
            // Arba net jei neprideda – jo realus palaikymas su sportu TĄ DIENĄ išaugo!
            // Tiksliausiam deficitui apskaičiuoti, sportas visada didina "Palaikymo TDEE".
            dynamicMaintenanceTDEE += burnedKcal;

            // Balansas: Tikrasis Palaikymo TDEE - Faktiškai suvartota
            periodBalanceKcal += (dynamicMaintenanceTDEE - (r.totalKcal || 0));
        });

        const avgKcal = Math.round(sumKcal / periodData.length);
        const avgTraining = Math.round(sumTraining / periodData.length);

        if (d7Kcal) d7Kcal.innerText = avgKcal;
        if (d7Training) d7Training.innerText = avgTraining;

        // Pervadinome balanso mygtuką, todėl tekstas lieka "+... kcal sutaupyta / viršyta" per nustatytą laikotarpį
        if (weeklyBal) {
            const roundedBal = Math.round(periodBalanceKcal);
            if (roundedBal >= 0) {
                weeklyBal.innerText = `+${roundedBal} kcal sutaupyta iš viso`;
                weeklyBal.style.color = 'var(--success)';
            } else {
                weeklyBal.innerText = `${roundedBal} kcal viršyta iš viso`;
                weeklyBal.style.color = 'var(--danger)';
            }
        }

        // Nupiešiame grafiką
        this.renderHistoryChart(periodData);

        // Sugeneruojame ir parodome AI patarėją
        // Pakeitimas: Paduodame tik periodData (praeities pilnas dienas), be šiandienos pusinių duomenų,
        // kad AI netransliuotų "trūksta baltymų" iš pat ryto pamaldavus tik pusryčius.
        this.analyzeWeeklyInsights(periodData);
    },

    analyzeWeeklyInsights(periodData) {
        const list = document.getElementById('weeklyInsightsList');
        if (!list) return;

        list.innerHTML = '';
        const insights = [];

        if (!periodData || periodData.length < 1) {
            list.innerHTML = '<li class="empty-state">Per mažai dienų analizei. Pridėkite šiandienos suvalgytą maistą.</li>';
            return;
        }

        let totalKcal = 0, totalP = 0, totalF = 0, totalC = 0, totalFib = 0;
        let successfulDays = 0;
        let cheatDays = 0;

        let lateCarbsCount = 0;
        let junkFoodCount = 0;
        let healthyFatsCount = 0;

        const junkPattern = /čipsai|cipsai|šokoladas|sokoladas|pica|burgeris|mėsainis|mesainis|saldainiai|tortas|pyragas|ledai|spurgos|bandel/i;
        const healthyFatPattern = /avokad|riešut|riesut|lašis|lasis|alyvuog|sėklos|seklos|chia|linų|linu/i;

        const p = this.data.profile;

        periodData.forEach(r => {
            const kcal = r.totalKcal || 0;
            totalKcal += kcal;
            totalP += (r.totalProtein || 0);
            totalF += (r.totalFat || 0);
            totalC += (r.totalCarbs || 0);
            totalFib += (r.totalFiber || 0);

            const dynamicTDEE = (p.eatBackCalories !== false) ? r.tdee + (r.trainingKcal || 0) : r.tdee;
            const maintenance = r.tdee - (p.goal || 0) + (r.trainingKcal || 0);

            if (kcal > 0 && kcal <= dynamicTDEE + 150) {
                successfulDays++;
            }

            if (kcal > maintenance + 300) {
                cheatDays++;
            }

            if (r.items && Array.isArray(r.items)) {
                r.items.forEach(item => {
                    const itemName = item.name ? item.name.toLowerCase() : '';
                    if (item.timestamp && typeof item.timestamp === 'string') {
                        const [hh] = item.timestamp.split(':');
                        const hour = parseInt(hh);
                        if (hour >= 20 && item.carbs > 15) {
                            lateCarbsCount++;
                        }
                    }
                    if (junkPattern.test(itemName)) junkFoodCount++;
                    if (healthyFatPattern.test(itemName)) healthyFatsCount++;
                });
            }
        });

        const daysWithRecords = periodData.filter(r => r.totalKcal > 0).length;
        if (daysWithRecords === 0) {
            list.innerHTML = '<li class="empty-state">Kol kas tuščia. Pridėkite suvalgyto maisto.</li>';
            return;
        }

        const pctP = ((totalP * 4) / totalKcal) * 100 || 0;
        const pctF = ((totalF * 9) / totalKcal) * 100 || 0;
        const pctC = ((totalC * 4) / totalKcal) * 100 || 0;
        
        const avgFiber = totalFib / daysWithRecords;
        const targetFiber = p.macros.fiber || Math.round((p.tdee / 1000) * 14);

        // --- Helper for Status Tags ---
        const getStatusTag = (current, target, isGram = false) => {
            const diff = current - target;
            const margin = isGram ? 3 : 5; // 3g margin for fiber, 5% for macros
            if (Math.abs(diff) <= margin) return '<span class="status-tag ok">Norma</span>';
            if (diff > margin) return '<span class="status-tag high">Viršyta</span>';
            return '<span class="status-tag low">Trūksta</span>';
        };

        const getMacroRow = (label, current, target, color, isGram = false) => {
            const unit = isGram ? 'g' : '%';
            let targetLeft = target;
            let fillWidth = current;

            if (isGram) {
                if (current >= target && target > 0) {
                    targetLeft = (target / current) * 100;
                    fillWidth = 100;
                } else if (target > 0) {
                    targetLeft = 100;
                    fillWidth = (current / target) * 100;
                } else {
                    targetLeft = 0; fillWidth = 0;
                }
            } else {
                fillWidth = Math.min(current, 100);
            }

            return `
            <div class="macro-comp-row">
                <div class="macro-comp-labels">
                    <span>${label}: <strong>${Math.round(current)}${unit}</strong> (tikslas ${Math.round(target)}${unit})</span>
                    ${getStatusTag(current, target, isGram)}
                </div>
                <div class="macro-comp-bar-bg">
                    <div class="macro-comp-target-line" style="left: ${targetLeft}%"></div>
                    <div class="macro-comp-bar-fill" style="width: ${fillWidth}%; background: ${color}"></div>
                </div>
            </div>
            `;
        };

        // --- ALWAYS ON: Weekly Overview (Refined) ---
        insights.push({
            type: 'info',
            icon: 'analytics',
            title: `Mitybos balansas (${daysWithRecords} d.)`,
            text: `Šie rodikliai rodo jūsų mitybos išklotinę: makroelementų proporcijas (%) ir kasdieninį skaidulų vidurkį (g).`,
            customHtml: `
                <div class="macro-comparison-container">
                    ${getMacroRow('Baltymai', pctP, 30, 'var(--macro-protein)')}
                    ${getMacroRow('Riebalai', pctF, 30, 'var(--macro-fat)')}
                    ${getMacroRow('Angliavandeniai', pctC, 40, 'var(--macro-carbs)')}
                    ${getMacroRow('Skaidulos (vid.)', avgFiber, targetFiber, 'var(--macro-fiber)', true)}
                </div>
            `
        });

        // --- Helper for finding recommendation from user's meals ---
        const findUserMealRecommendation = (type) => {
            if (!this.data.meals || this.data.meals.length === 0) return null;
            
            return this.data.meals.find(m => {
                const kcal = m.kcal;
                const pRatio = (m.protein * 4) / kcal;
                const fRatio = (m.fat * 9) / kcal;
                const cRatio = (m.carbs * 4) / kcal;
                
                if (type === 'protein') return pRatio > 0.3;
                if (type === 'healthy_fat') return fRatio > 0.4;
                if (type === 'balanced') return pRatio > 0.2 && pRatio < 0.4;
                return false;
            });
        };

        // 1. Consistency
        if (successfulDays === periodData.length) {
            insights.push({ 
                type: 'success', 
                icon: 'verified',
                title: 'Geležinė kantrybė!', 
                text: `Visas ${periodData.length} dienas laikėtės plano. Tai tiesiausias kelias į tikslą!` 
            });
        } else if (cheatDays > 1) {
            insights.push({ 
                type: 'danger', 
                icon: 'warning_amber',
                title: 'Kalorijų kalneliai', 
                text: `Pastebėjome ${cheatDays} dienas su dideliu viršijimu. Stabilumas yra svarbiau už vienkartines pastangas.` 
            });
        }

        // 2. Protein
        const avgP_grams = totalP / daysWithRecords;
        const gPerKg = avgP_grams / p.weight;

        if (gPerKg < 1.2 || pctP < 20) {
            const mealRec = findUserMealRecommendation('protein');
            insights.push({ 
                type: 'warning', 
                icon: 'fitness_center',
                title: 'Stiprinkime raumenis', 
                text: `Baltymai sudaro tik ${pctP.toFixed(0)}% raciono. Jie padeda išvengti alkio ir saugo raumenis.`,
                recommendation: mealRec ? `Išbandykite savo receptą: <strong>${mealRec.name}</strong> – jis puikus baltymų šaltinis!` : 'Pabandykite įtraukti daugiau kiaušinių, liesos mėsos ar ankštinių augalų.'
            });
        } else if (pctP > 40) {
            insights.push({ 
                type: 'info', 
                icon: 'info',
                title: 'Baltymų galia', 
                text: `Baltymai sudaro net ${pctP.toFixed(0)}% raciono. Puiku sotumui, bet nepamirškite ir sveikų skaidulų!` 
            });
        }

        // 3. Fats
        if (pctF < 20) {
            const mealRec = findUserMealRecommendation('healthy_fat');
            insights.push({ 
                type: 'warning', 
                icon: 'favorite',
                title: 'Hormonų sveikata', 
                text: `Riebalų kiekis (${pctF.toFixed(0)}%) yra gana žemas. Sveiki riebalai būtini savijautai.`,
                recommendation: mealRec ? `Jūsų receptas <strong>${mealRec.name}</strong> padėtų subalansuoti riebalus!` : 'Pridėkite šlakelį alyvuogių aliejaus ar saują riešutų.'
            });
        } else if (pctF > 40) {
            insights.push({ 
                type: 'danger', 
                icon: 'opacity',
                title: 'Riebalų tankis', 
                text: `Riebalai sudaro ${pctF.toFixed(0)}% kalorijų. Maistas tampa labai kaloringas mažame tūryje, todėl sunkiau pasisotinti.` 
            });
        }

        // 4. Carbs
        if (pctC > 55) {
            insights.push({ 
                type: 'warning', 
                icon: 'bolt',
                title: 'Energijos šuoliai', 
                text: `Angliavandeniai dominuoja (${pctC.toFixed(0)}%). Jei trūksta energijos po valgio, pabandykite juos kombinuoti su baltymais.` 
            });
        }

        // 5. Habits
        if (lateCarbsCount >= 2) {
            insights.push({ 
                type: 'info', 
                icon: 'bedtime',
                title: 'Vėlyva energija', 
                text: `Vakarais renkatės daug angliavandenių. Jei ryte jaučiatės sunkiai, pabandykite juos perkelti į dienos vidurį.` 
            });
        }

        if (junkFoodCount >= 3) {
            insights.push({ 
                type: 'danger', 
                icon: 'fastfood',
                title: 'Maisto kokybė', 
                text: `Racione pasirodė nemažai perdirbtų produktų. Stenkitės grįžti prie "gryno" maisto energijai palaikyti.` 
            });
        }

        if (healthyFatsCount > 0 && pctF >= 20) {
            insights.push({ 
                type: 'success', 
                icon: 'star',
                title: 'Švari mityba', 
                text: `Puiku! Randame kokybiškų riebalų šaltinių. Tai puiki investicija į ilgalaikę sveikatą.` 
            });
        }

        // Render UI
        if (insights.length === 0) {
            list.innerHTML = '<li class="empty-state" style="color:var(--success)">Viskas atrodo puikiai! Didelių nukrypimų neradome.</li>';
            return;
        }

        insights.forEach(ins => {
            const li = document.createElement('li');
            li.className = `insight-card ${ins.type}`;

            let html = `
                <div class="insight-icon">
                    <span class="material-icons-round">${ins.icon || 'lightbulb'}</span>
                </div>
                <div class="insight-content">
                    <strong>${ins.title}</strong>
                    <div>${ins.text}</div>
                    ${ins.customHtml || ''}
            `;
            
            if (ins.recommendation) {
                html += `
                    <div class="insight-recommendation">
                        <span class="material-icons-round">tips_and_updates</span>
                        <span>${ins.recommendation}</span>
                    </div>
                `;
            }
            
            html += `</div>`;
            li.innerHTML = html;
            list.appendChild(li);
        });
    },


    renderHistoryChart(periodData) {
        if (!window.Chart) return; // Jei Chart.js dar neužsikrovė
        const ctx = document.getElementById('historyChart');
        if (!ctx) return;

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        if (!periodData || periodData.length === 0) return;

        const labels = periodData.map(r => r.date ? r.date.substring(5) : ""); // pvz: "03-01"
        const consumedData = periodData.map(r => r.totalKcal);

        const targetData = periodData.map(r => {
            const burnedKcal = r.trainingKcal || 0;
            return this.data.profile.eatBackCalories !== false ? r.tdee + burnedKcal : r.tdee;
        });

        const weightData = periodData.map(r => r.weight || null);

        // Apskaičiuojame svorio min ir max rėžius, kad ašis nebūtų nuo 0
        const validWeights = weightData.filter(w => w !== null && w > 0);
        let minWeight = Math.min(...validWeights) - 2;
        let maxWeight = Math.max(...validWeights) + 2;

        // Jei kažkodėl nėra svorio duomenų arba jie lygūs begalybei
        if (!isFinite(minWeight) || !isFinite(maxWeight)) {
            minWeight = 50;
            maxWeight = 100;
        }

        // Nustatome stulpelių spalvas pagal tai ar viršijo normą
        const bgColors = consumedData.map((consumed, index) => {
            const target = targetData[index];
            const diff = target - consumed;
            if (diff >= 0) return '#2ea043'; // Žalia
            if (diff >= -150) return '#d29922'; // Geltona
            return '#f85149'; // Raudona
        });

        this.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'line',
                        label: 'Svoris (kg)',
                        data: weightData,
                        borderColor: '#a371f7',
                        backgroundColor: '#a371f7',
                        yAxisID: 'yWeight',
                        tension: 0.3,
                        pointRadius: 4,
                        borderWidth: 2,
                        spanGaps: true // Sujungs kreivę per tas dienas, kai svoris neregistruotas
                    },
                    {
                        type: 'line',
                        label: 'Dienos Norma',
                        data: targetData,
                        borderColor: 'rgba(255, 255, 255, 0.5)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        yAxisID: 'yKcal',
                        pointRadius: 0,
                        fill: false
                    },
                    {
                        type: 'bar',
                        label: 'Suvartota Kcal',
                        data: consumedData,
                        backgroundColor: bgColors,
                        borderRadius: 4,
                        yAxisID: 'yKcal'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#8b949e',
                            font: { size: 10 }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#8b949e', font: { size: 10 } },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    },
                    yKcal: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        ticks: { color: '#8b949e', font: { size: 10 } },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        title: { display: true, text: 'Kcal', color: '#8b949e', font: { size: 10 } }
                    },
                    yWeight: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        min: minWeight,
                        max: maxWeight,
                        ticks: { color: '#a371f7', font: { size: 10 }, stepSize: 1 },
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: 'Svoris (kg)', color: '#a371f7', font: { size: 10 } }
                    }
                }
            }
        });
    },

    // --- AI Asistentas: Ką suvalgyti? ---
    generateMealSuggestion() {
        const p = this.data.profile;
// ... (logika palikta ta pati)
        const c = this.data.consumedToday;

        if (!p || !p.weight) return alert("Pirmiausia užpildykite profilį!");

        // Pagalbinė funkcija atsitiktiniam pasirinkimui
        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

        // 1. Apskaičiuojam kiek liko
        const targetKcal = p.eatBackCalories !== false ? p.tdee + (c.trainingKcal || 0) : p.tdee;
        const remainingKcal = targetKcal - c.totalKcal;

        const targetP = p.weight * 2.0; // orientacinis 2g/kg baltymų
        const remainingP = targetP - c.totalProtein;

        const targetF = p.weight * 1.0; // orientacinis 1g/kg riebalų
        const remainingF = targetF - c.totalFat;

        let suggestion = "";

        if (remainingKcal <= 0) {
            suggestion = pick([
                "<b>Jūsų dienos kalorijų norma jau užpildyta!</b><br>Jei vis dar jaučiate alkį, rekomenduojame išgerti vandens arbą suvalgyti lengvą daržovių salotą be riebaus padažo.",
                "<b>Kalorijų tikslas pasiektas!</b><br>Geriausia būtų likti prie vandens ar nesaldintos arbatos. Jei labai norisi ko nors kramtyti – agurkas yra puikus pasirinkimas.",
                "<b>Dienos limitas viršytas arba pasiektas.</b><br>Rekomenduojame šiandien daugiau nebevalgyti, kad išlaikytumėte svorio metimo tempą."
            ]);
        } else if (remainingKcal < 200) {
            if (remainingP > 15) {
                suggestion = pick([
                    `<b>Liko nedaug kalorijų (~${Math.round(remainingKcal)} kcal), bet trūksta baltymų.</b><br>Pasiūlymas: <i>150g liesos varškės arba Islandiško jogurto (Skyr)</i>.`,
                    `<b>Mažai kalorijų (~${Math.round(remainingKcal)} kcal), didelis baltymų poreikis.</b><br>Pasiūlymas: <i>Kiaušinio baltymo omletas arba baltyminis kokteilis su vandeniu</i>.`,
                    `<b>Tik ~${Math.round(remainingKcal)} kcal liko, griebkite baltymų!</b><br>Pasiūlymas: <i>Keletą riekelių lieso kumpio arba virtą kiaušinį</i>.`
                ]);
            } else {
                suggestion = pick([
                    `<b>Liko visai nedaug (~${Math.round(remainingKcal)} kcal).</b><br>Galite suvalgyti vieną nedidelį vaisių (pvz., obuolį ar didelį mandariną), arba mažą saują uogų.`,
                    `<b>Mažas likutis (~${Math.round(remainingKcal)} kcal).</b><br>Rekomenduojame saują mėlynių arba porą ryžių trapučių.`,
                    `<b>Pabaigai liko ~${Math.round(remainingKcal)} kcal.</b><br>Geriausia tiktų daržovės su trupučiu humuso arba tiesiog stiklinė kefyro.`
                ]);
            }
        } else if (remainingKcal >= 200 && remainingKcal <= 500) {
            if (remainingP > 25) {
                suggestion = pick([
                    `<b>Liko smagus užkandis (~${Math.round(remainingKcal)} kcal), tačiau labai trūksta baltymų!</b><br>Rekomendacija: <i>Baltyminis kokteilis, 2 kietai virti kiaušiniai, arba varškės desertas su uogomis</i>.`,
                    `<b>Tarpinis valgis (~${Math.round(remainingKcal)} kcal) su daug baltymų.</b><br>Rekomendacija: <i>Tunas savo sultyse su agurkais arba pakelis neriebios varškės su prieskoniais</i>.`,
                    `<b>Reikia baltymų (~${Math.round(remainingKcal)} kcal ribose)!</b><br>Rekomendacija: <i>Graikiškas jogurtas su keliais riešutais arba vištienos krūtinėlės salotos</i>.`
                ]);
            } else if (remainingF > 15) {
                suggestion = pick([
                    `<b>Liko apie ${Math.round(remainingKcal)} kcal, bet dienai trūksta sveikų riebalų.</b><br>Rekomendacija: <i>Sauja mėgstamų riešutų (apie 30g), pusė avokado su trapučiu, arba žemės riešutų sviestas su obuoliu</i>.`,
                    `<b>Riebalų deficitas (~${Math.round(remainingKcal)} kcal).</b><br>Rekomendacija: <i>Moliūgų sėklų sauja arba graikiniai riešutai</i>.`,
                    `<b>Sutvarkykime riebalus (~${Math.round(remainingKcal)} kcal).</b><br>Rekomendacija: <i>Alyvuogės arba riebesnės žuvies (pvz. lašišos) užkandis</i>.`
                ]);
            } else {
                suggestion = pick([
                    `<b>Liko dar pakankamai kalorijų geram užkandžiui (~${Math.round(remainingKcal)} kcal).</b><br>Rekomendacija: <i>Dubenėlis avižinės košės, pilno grūdo sumuštinis su vištiena, ar lengvos salotos su feta sūriu</i>.`,
                    `<b>Subalansuotas likutis (~${Math.round(remainingKcal)} kcal).</b><br>Rekomendacija: <i>Vaisių salotos su jogurtu arba trapučiai su sūriu</i>.`,
                    `<b>Laisvė pasirinkti (~${Math.round(remainingKcal)} kcal).</b><br>Rekomendacija: <i>Sveikas batonėlis arba stiklinė pieno su keliais sausainiais (pilno grūdo)</i>.`
                ]);
            }
        } else {
            // Daugiau nei 500 kcal
            if (remainingP > 30) {
                suggestion = pick([
                    `<b>Dar turite laisvės pilnam patiekalui (~${Math.round(remainingKcal)} kcal), tačiau ryškiai trūksta baltymų!</b><br>Rekomendacija: <i>Kepta lašiša ar vištienos krūtinėlė su ryžiais ir garintomis daržovėmis</i>.`,
                    `<b>Didelis likutis (~${Math.round(remainingKcal)} kcal), pasirūpinkite baltymais.</b><br>Rekomendacija: <i>Jautienos didepsnis (steak) su šviežiomis daržovėmis</i>.`,
                    `<b>Pabaigai – baltyminė bomba (~${Math.round(remainingKcal)} kcal).</b><br>Rekomendacija: <i>Varškėčiai (virti ar kepti) su paprastu jogurtu</i>.`
                ]);
            } else {
                suggestion = pick([
                    `<b>Liko didelė norma – galite suvalgyti pilnavertį patiekalą (~${Math.round(remainingKcal)} kcal).</b><br>Pvz.: <i>Mėsos troškinys, makaronai su pomidorų padažu ir sūriu, ar didelis dubuo mėgstamų salotų</i>.`,
                    `<b>Vis dar turite kokių ~${Math.round(remainingKcal)} kcal vakarienei.</b><br>Pvz.: <i>Lazanija, pica su daug daržovių ar gausios salotos su riešutais</i>.`,
                    `<b>Didelė laisvė rinktis (~${Math.round(remainingKcal)} kcal).</b><br>Pvz.: <i>Wok keptuvėje ruošti makaronai su daržovėmis ir mėsa</i>.`
                ]);
            }
        }

        document.getElementById('aiSuggestionText').innerHTML = suggestion;
        this.showModal('aiSuggestModal');
    },

    setupOnlineSearch() {
        const btn = document.getElementById('onlineSearchBtn');
        const input = document.getElementById('onlineSearchInput');
        if (!btn || !input) return;

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchOpenFoodFacts(input.value);
        });

        btn.addEventListener('click', () => {
            this.searchOpenFoodFacts(input.value);
        });
    },

    basicFoodsDatabase: [
        { product_name: "Obuolys", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 52, proteins_100g: 0.3, fat_100g: 0.2, carbohydrates_100g: 14, fiber_100g: 2.4 } },
        { product_name: "Bananas", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 89, proteins_100g: 1.1, fat_100g: 0.3, carbohydrates_100g: 23, fiber_100g: 2.6 } },
        { product_name: "Kriaušė", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 57, proteins_100g: 0.4, fat_100g: 0.1, carbohydrates_100g: 15, fiber_100g: 3.1 } },
        { product_name: "Apelsinas", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 47, proteins_100g: 0.9, fat_100g: 0.1, carbohydrates_100g: 12, fiber_100g: 2.4 } },
        { product_name: "Mandarinai", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 53, proteins_100g: 0.8, fat_100g: 0.3, carbohydrates_100g: 13, fiber_100g: 1.8 } },
        { product_name: "Kiviai", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 61, proteins_100g: 1.1, fat_100g: 0.5, carbohydrates_100g: 15, fiber_100g: 3 } },
        { product_name: "Braškės", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 32, proteins_100g: 0.7, fat_100g: 0.3, carbohydrates_100g: 7.7, fiber_100g: 2 } },
        { product_name: "Šilauogės (Mėlynės)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 57, proteins_100g: 0.7, fat_100g: 0.3, carbohydrates_100g: 14, fiber_100g: 2.4 } },
        { product_name: "Vyšnios", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 50, proteins_100g: 1, fat_100g: 0.3, carbohydrates_100g: 12, fiber_100g: 1.6 } },
        { product_name: "Slyva", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 46, proteins_100g: 0.7, fat_100g: 0.3, carbohydrates_100g: 11, fiber_100g: 1.4 } },
        { product_name: "Vynuogės", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 69, proteins_100g: 0.7, fat_100g: 0.2, carbohydrates_100g: 18, fiber_100g: 0.9 } },
        { product_name: "Ananasas", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 50, proteins_100g: 0.5, fat_100g: 0.1, carbohydrates_100g: 13, fiber_100g: 1.4 } },
        { product_name: "Melionas", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 34, proteins_100g: 0.8, fat_100g: 0.2, carbohydrates_100g: 8, fiber_100g: 0.9 } },
        { product_name: "Arbūzas", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 30, proteins_100g: 0.6, fat_100g: 0.2, carbohydrates_100g: 8, fiber_100g: 0.4 } },
        { product_name: "Avietės", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 52, proteins_100g: 1.2, fat_100g: 0.7, carbohydrates_100g: 12, fiber_100g: 6.5 } },
        { product_name: "Gervuogės", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 43, proteins_100g: 1.4, fat_100g: 0.5, carbohydrates_100g: 10, fiber_100g: 5 } },
        { product_name: "Persikas", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 39, proteins_100g: 0.9, fat_100g: 0.2, carbohydrates_100g: 10, fiber_100g: 1.5 } },
        { product_name: "Nektarinas", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 44, proteins_100g: 1, fat_100g: 0.3, carbohydrates_100g: 11, fiber_100g: 1.7 } },
        { product_name: "Abrikosas", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 48, proteins_100g: 1.4, fat_100g: 0.4, carbohydrates_100g: 11, fiber_100g: 2 } },
        { product_name: "Greipfrutas", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 42, proteins_100g: 0.8, fat_100g: 0.1, carbohydrates_100g: 11, fiber_100g: 1.6 } },
        { product_name: "Mango (Mangas)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 60, proteins_100g: 0.8, fat_100g: 0.4, carbohydrates_100g: 15, fiber_100g: 1.6 } },
        { product_name: "Granatas", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 83, proteins_100g: 1.7, fat_100g: 1.2, carbohydrates_100g: 19, fiber_100g: 4 } },
        { product_name: "Pomidoras", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 18, proteins_100g: 0.9, fat_100g: 0.2, carbohydrates_100g: 3.9, fiber_100g: 1.2 } },
        { product_name: "Agurkas", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 15, proteins_100g: 0.6, fat_100g: 0.1, carbohydrates_100g: 3.6, fiber_100g: 0.5 } },
        { product_name: "Paprika", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 31, proteins_100g: 1, fat_100g: 0.3, carbohydrates_100g: 6, fiber_100g: 2 } },
        { product_name: "Svogūnas", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 40, proteins_100g: 1.1, fat_100g: 0.1, carbohydrates_100g: 9.3, fiber_100g: 1.7 } },
        { product_name: "Česnakas", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 149, proteins_100g: 6.4, fat_100g: 0.5, carbohydrates_100g: 33, fiber_100g: 2.1 } },
        { product_name: "Morka", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 41, proteins_100g: 0.9, fat_100g: 0.2, carbohydrates_100g: 9.6, fiber_100g: 2.8 } },
        { product_name: "Avokadas", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 160, proteins_100g: 2, fat_100g: 15, carbohydrates_100g: 9, fiber_100g: 7 } },
        { product_name: "Cukinija", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 17, proteins_100g: 1.2, fat_100g: 0.3, carbohydrates_100g: 3, fiber_100g: 1 } },
        { product_name: "Baklažanas", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 25, proteins_100g: 1, fat_100g: 0.2, carbohydrates_100g: 6, fiber_100g: 3 } },
        { product_name: "Brokoliai", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 34, proteins_100g: 2.8, fat_100g: 0.4, carbohydrates_100g: 7, fiber_100g: 2.6 } },
        { product_name: "Žiedinis kopūstas (Kalafioras)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 25, proteins_100g: 2, fat_100g: 0.3, carbohydrates_100g: 5, fiber_100g: 2 } },
        { product_name: "Baltagūžis kopūstas", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 25, proteins_100g: 1.3, fat_100g: 0.1, carbohydrates_100g: 6, fiber_100g: 2.5 } },
        { product_name: "Raudonasis kopūstas", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 31, proteins_100g: 1.4, fat_100g: 0.2, carbohydrates_100g: 7, fiber_100g: 2.1 } },
        { product_name: "Pekino kopūstas", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 16, proteins_100g: 1.2, fat_100g: 0.2, carbohydrates_100g: 3, fiber_100g: 1.2 } },
        { product_name: "Briuselio kopūstai", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 43, proteins_100g: 3.4, fat_100g: 0.3, carbohydrates_100g: 9, fiber_100g: 3.8 } },
        { product_name: "Ridikėliai", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 16, proteins_100g: 0.7, fat_100g: 0.1, carbohydrates_100g: 3.4, fiber_100g: 1.6 } },
        { product_name: "Salierai (lapkočiai)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 16, proteins_100g: 0.7, fat_100g: 0.2, carbohydrates_100g: 3, fiber_100g: 1.6 } },
        { product_name: "Burokėliai (žali)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 43, proteins_100g: 1.6, fat_100g: 0.2, carbohydrates_100g: 10, fiber_100g: 2.8 } },
        { product_name: "Špinatai", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 23, proteins_100g: 2.9, fat_100g: 0.4, carbohydrates_100g: 4, fiber_100g: 2.2 } },
        { product_name: "Poras", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 61, proteins_100g: 1.5, fat_100g: 0.3, carbohydrates_100g: 14, fiber_100g: 1.8 } },
        { product_name: "Kukurūzai (saldieji)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 86, proteins_100g: 3.3, fat_100g: 1.4, carbohydrates_100g: 19, fiber_100g: 2 } },
        { product_name: "Žirneliai (žalieji)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 81, proteins_100g: 5.4, fat_100g: 0.4, carbohydrates_100g: 14, fiber_100g: 5 } },
        { product_name: "Šparaginės pupelės", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 31, proteins_100g: 1.8, fat_100g: 0.2, carbohydrates_100g: 7, fiber_100g: 2.7 } },
        { product_name: "Moliūgas", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 26, proteins_100g: 1, fat_100g: 0.1, carbohydrates_100g: 6, fiber_100g: 0.5 } },
        { product_name: "Smydrai (Šparagai)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 20, proteins_100g: 2.2, fat_100g: 0.1, carbohydrates_100g: 4, fiber_100g: 2.1 } },
        { product_name: "Saldžioji bulvė (Batatas)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 86, proteins_100g: 1.6, fat_100g: 0.1, carbohydrates_100g: 20, fiber_100g: 3 } },
        { product_name: "Bulvės (žalios)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 77, proteins_100g: 2, fat_100g: 0.1, carbohydrates_100g: 17, fiber_100g: 2.2 } },
        { product_name: "Salotų lapai (Iceberg kt.)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 14, proteins_100g: 0.9, fat_100g: 0.1, carbohydrates_100g: 2.9, fiber_100g: 1.2 } },
        { product_name: "Kiaušinis", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 143, proteins_100g: 13, fat_100g: 10, carbohydrates_100g: 0.7, fiber_100g: 0 } },
        { product_name: "Vištienos krūtinėlė (žalia)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 110, proteins_100g: 23, fat_100g: 1.2, carbohydrates_100g: 0, fiber_100g: 0 } },
        { product_name: "Vištienos krūtinėlė (kepta/virta)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 165, proteins_100g: 31, fat_100g: 3.6, carbohydrates_100g: 0, fiber_100g: 0 } },
        { product_name: "Kiauliena (liesa)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 143, proteins_100g: 21, fat_100g: 6, carbohydrates_100g: 0, fiber_100g: 0 } },
        { product_name: "Jautiena (liesa)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 250, proteins_100g: 26, fat_100g: 15, carbohydrates_100g: 0, fiber_100g: 0 } },
        { product_name: "Lašiša (žalia)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 208, proteins_100g: 20, fat_100g: 13, carbohydrates_100g: 0, fiber_100g: 0 } },
        { product_name: "Pienas 2.5%", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 54, proteins_100g: 3.2, fat_100g: 2.5, carbohydrates_100g: 4.7, fiber_100g: 0 } },
        { product_name: "Kefyras 2.5%", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 50, proteins_100g: 2.8, fat_100g: 2.5, carbohydrates_100g: 4, fiber_100g: 0 } },
        { product_name: "Varškė 9%", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 159, proteins_100g: 16, fat_100g: 9, carbohydrates_100g: 2, fiber_100g: 0 } },
        { product_name: "Varškė liesa (0.5%)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 85, proteins_100g: 18, fat_100g: 0.5, carbohydrates_100g: 1.8, fiber_100g: 0 } },
        { product_name: "Graikiškas jogurtas", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 97, proteins_100g: 9, fat_100g: 5, carbohydrates_100g: 4, fiber_100g: 0 } },
        { product_name: "Sūris Fermentinis (~45%)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 345, proteins_100g: 25, fat_100g: 27, carbohydrates_100g: 1, fiber_100g: 0 } },
        { product_name: "Ryžiai (nevirti)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 360, proteins_100g: 7, fat_100g: 1, carbohydrates_100g: 80, fiber_100g: 1 } },
        { product_name: "Grikių kruopos (nevirtos)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 343, proteins_100g: 13, fat_100g: 3.4, carbohydrates_100g: 71, fiber_100g: 10 } },
        { product_name: "Avižiniai dribsniai", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 389, proteins_100g: 17, fat_100g: 7, carbohydrates_100g: 66, fiber_100g: 10 } },
        { product_name: "Makaronai (nevirti)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 371, proteins_100g: 13, fat_100g: 1.5, carbohydrates_100g: 74, fiber_100g: 3 } },
        { product_name: "Kvietiniai miltai", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 364, proteins_100g: 10, fat_100g: 1, carbohydrates_100g: 76, fiber_100g: 3 } },
        { product_name: "Ruginė juoda duona", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 259, proteins_100g: 6, fat_100g: 1, carbohydrates_100g: 56, fiber_100g: 6 } },
        { product_name: "Batono riekė", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 265, proteins_100g: 9, fat_100g: 3.2, carbohydrates_100g: 49, fiber_100g: 2.7 } },
        { product_name: "Sviestas 82%", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 717, proteins_100g: 0.8, fat_100g: 82, carbohydrates_100g: 0.8, fiber_100g: 0 } },
        { product_name: "Alyvuogių aliejus", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 884, proteins_100g: 0, fat_100g: 100, carbohydrates_100g: 0, fiber_100g: 0 } },
        { product_name: "Saulėgrąžų aliejus", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 884, proteins_100g: 0, fat_100g: 100, carbohydrates_100g: 0, fiber_100g: 0 } },
        { product_name: "Graikiniai riešutai", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 654, proteins_100g: 15, fat_100g: 65, carbohydrates_100g: 14, fiber_100g: 7 } },
        { product_name: "Migdolai", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 579, proteins_100g: 21, fat_100g: 50, carbohydrates_100g: 22, fiber_100g: 13 } },
        { product_name: "Žemės riešutų sviestas", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 588, proteins_100g: 25, fat_100g: 50, carbohydrates_100g: 20, fiber_100g: 6 } },
        { product_name: "Tunas (savo sultyse)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 116, proteins_100g: 26, fat_100g: 1, carbohydrates_100g: 0, fiber_100g: 0 } },
        { product_name: "Tunas (aliejuje)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 198, proteins_100g: 29, fat_100g: 8, carbohydrates_100g: 0, fiber_100g: 0 } },
        { product_name: "Silkių filė (aliejuje)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 250, proteins_100g: 18, fat_100g: 20, carbohydrates_100g: 0, fiber_100g: 0 } },
        { product_name: "Medus", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 304, proteins_100g: 0.3, fat_100g: 0, carbohydrates_100g: 82, fiber_100g: 0.2 } },
        { product_name: "Cukrus", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 387, proteins_100g: 0, fat_100g: 0, carbohydrates_100g: 100, fiber_100g: 0 } },
        { product_name: "Juodas šokoladas (70%)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 598, proteins_100g: 7.8, fat_100g: 42, carbohydrates_100g: 36, fiber_100g: 10 } },
        { product_name: "Pieninis šokoladas", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 535, proteins_100g: 7.6, fat_100g: 29, carbohydrates_100g: 59, fiber_100g: 3.4 } },
        { product_name: "Grikiai (virti)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 92, proteins_100g: 3.4, fat_100g: 0.6, carbohydrates_100g: 20, fiber_100g: 2.7 } },
        { product_name: "Ryžiai (virti)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 130, proteins_100g: 2.7, fat_100g: 0.3, carbohydrates_100g: 28, fiber_100g: 0.4 } },
        { product_name: "Makaronai (virti)", brands: "Baziniai", nutriments: { 'energy-kcal_100g': 158, proteins_100g: 5.8, fat_100g: 0.9, carbohydrates_100g: 31, fiber_100g: 1.8 } }
    ],

    searchOpenFoodFacts(query, customUrl = null) {
        if (!query || query.trim().length === 0) return;

        const loader = document.getElementById('onlineLoader');
        const list = document.getElementById('onlineSearchResults');

        if (!loader || !list) return;

        loader.classList.remove('hidden');
        if (!customUrl) list.innerHTML = '';

        // Pirmiausia surandame atitikmenis tarp mūsų suvestų bazinių ingredientų (lietuvybių)
        const queryLower = query.toLowerCase().trim();
        const localMatches = this.basicFoodsDatabase.filter(food => 
            food.product_name.toLowerCase().includes(queryLower)
        );

        const url = customUrl || `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=15`;

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error(`Serverio klaida: ${res.status}`);
                return res.json();
            })
            .then(data => {
                loader.classList.add('hidden');

                const productsToRender = [];
                
                // Pridedame savo vietinius (lietuviškus, nebrendinius) rezultatus pradžioje
                if (localMatches.length > 0) {
                    productsToRender.push(...localMatches);
                }

                if (data.products && data.products.length > 0) {
                    productsToRender.push(...data.products);
                }

                if (productsToRender.length === 0) {
                    list.innerHTML = '<li class="empty-state">Rezultatų nerasta. Bandykite anglišką žodį arba naudokite barkodų skenerį.</li>';
                    return;
                }

                this.renderOnlineSearchResults(productsToRender);
            })
            .catch(err => {
                console.error('API Error:', err);
                
                if (url.includes('.org')) {
                    this.searchOpenFoodFacts(query, url.replace('.org', '.net'));
                    return;
                }

                loader.classList.add('hidden');
                
                // Nors interetas neveikia ar API klaida, PARODOM ką turime vietinėje bazėje (jeigu radom)
                if (localMatches.length > 0) {
                    this.renderOnlineSearchResults(localMatches);
                    list.innerHTML += `<li class="empty-state" style="color:var(--text-muted); font-size:12px; margin-top:20px;">Nepavyko susisiekti su išoriniu serveriu dėl pilnų rezultatų. Parodyti tik baziniai produktai.</li>`;
                } else {
                    list.innerHTML = `
                        <li class="empty-state" style="color:var(--danger)">
                            <strong>Nepavyko susisiekti su duomenų baze.</strong><br>
                            <small>${err.message}</small>
                        </li>`;
                }
            });
    },

    renderOnlineSearchResults(products) {
        const list = document.getElementById('onlineSearchResults');
        if (!list) return;
        list.innerHTML = '';

        const validProducts = [];
        products.forEach(p => {
            const nutriments = p.nutriments || {};
            let kcal = nutriments['energy-kcal_100g'] || (nutriments['energy_100g'] / 4.184);
            if (kcal !== undefined && kcal >= 0) {
                validProducts.push({ p, kcal });
            }
        });

        if (validProducts.length === 0) {
            list.innerHTML = '<li class="empty-state">Trūksta duomenų.</li>';
            return;
        }

        validProducts.forEach(item => {
            const p = item.p;
            const kcal = Math.round(item.kcal);
            const name = p.product_name || p.generic_name || 'Produktas';
            const brand = p.brands ? `(${p.brands.split(',')[0]})` : '';

            const nutriments = p.nutriments || {};
            const protein = Math.round(nutriments.proteins_100g || 0);
            const fat = Math.round(nutriments.fat_100g || 0);
            const carbs = Math.round(nutriments.carbohydrates_100g || 0);
            const fiber = Math.round(nutriments.fiber_100g || 0);

            const li = document.createElement('li');
            li.className = 'glass-card mt-10';
            li.style.display = 'flex';
            li.style.flexDirection = 'column';
            li.style.gap = '10px';

            const safeNameStr = encodeURIComponent(`${name} ${brand}`.trim());

            li.innerHTML = `
                <div>
                    <strong>${name} ${brand}</strong>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                        100g: <strong>${kcal} kcal</strong> | B: ${protein}g | R: ${fat}g | A: ${carbs}g | S: ${fiber}g
                    </div>
                </div>
                <button class="btn btn-primary" style="font-size:12px; padding: 6px; background: var(--success);" onclick="app.importOnlineFood('${safeNameStr}', ${kcal}, ${protein}, ${fat}, ${carbs}, ${fiber})">
                    <span class="material-icons-round" style="font-size:16px;">download</span> Išsaugoti
                </button>
            `;
            list.appendChild(li);
        });
    },

    importOnlineFood(encodedName, kcal, protein, fat, carbs, fiber = 0) {
        const name = decodeURIComponent(encodedName);
        
        if (!confirm(`Pridėti produktą?\n\n${name}\n${kcal} kcal | B: ${protein}g | R: ${fat}g | A: ${carbs}g | S: ${fiber}g`)) {
            return;
        }

        this.data.foods.push({
            id: Date.now(),
            name: name,
            kcal: kcal,
            protein: protein,
            fat: fat,
            carbs: carbs,
            fiber: fiber
        });

        this.saveData();
        this.renderFoodsList();
        this.updateIngredientSelect();

        this.closeModal('searchOnlineModal');
        this.closeModal('barcodeScannerModal');
        alert(`Išsaugota!`);
    },

    barcodeScanner: null,

    startBarcodeScanner() {
        this.showModal('barcodeScannerModal');
        if (!this.barcodeScanner) {
            this.barcodeScanner = new Html5Qrcode("barcodeReader");
        }
        const config = { fps: 10, qrbox: { width: 250, height: 150 } };
        this.barcodeScanner.start(
            { facingMode: "environment" }, 
            config, 
            (decodedText) => {
                this.stopBarcodeScanner();
                this.searchByBarcode(decodedText);
            },
            () => {}
        ).catch(err => {
            console.error(err);
            document.getElementById('barcodeStatus').innerText = "Kameros klaida.";
        });
    },

    stopBarcodeScanner() {
        if (this.barcodeScanner) {
            this.barcodeScanner.stop().then(() => {
                this.closeModal('barcodeScannerModal');
            }).catch(() => this.closeModal('barcodeScannerModal'));
        } else {
            this.closeModal('barcodeScannerModal');
        }
    },

    searchByBarcode(barcode, customUrl = null) {
        const status = document.getElementById('barcodeStatus');
        if (status) status.innerText = `Ieškoma: ${barcode}...`;

        const url = customUrl || `https://world.openfoodfacts.org/api/v2/product/${barcode}`;

        fetch(url, { headers: { 'User-Agent': 'FoodTrackerApp - v1.0' } })
            .then(res => res.json())
            .then(data => {
                if (data.status === 1) {
                    const p = data.product;
                    const n = p.nutriments || {};
                    let kcal = n['energy-kcal_100g'] || (n['energy_100g'] / 4.184);
                    
                    if (kcal === undefined) return alert("Trūksta duomenų.");

                    const fullName = `${p.product_name || 'Produktas'} ${p.brands ? '(' + p.brands.split(',')[0] + ')' : ''}`.trim();
                    this.importOnlineFood(
                        encodeURIComponent(fullName), 
                        Math.round(kcal), 
                        Math.round(n.proteins_100g || 0), 
                        Math.round(n.fat_100g || 0), 
                        Math.round(n.carbohydrates_100g || 0), 
                        Math.round(n.fiber_100g || 0)
                    );
                } else {
                    if (url.includes('.org')) {
                        this.searchByBarcode(barcode, url.replace('.org', '.net'));
                    } else {
                        alert("Nerasta.");
                    }
                }
            })
            .catch(() => {
                if (url.includes('.org')) {
                    this.searchByBarcode(barcode, url.replace('.org', '.net'));
                } else {
                    alert("Ryšio klaida.");
                }
            });
    }

};

// Paleisti programą užsikrovus
window.addEventListener('DOMContentLoaded', () => {
    app.init();
});
