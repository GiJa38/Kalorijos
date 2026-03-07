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
            macros: { protein: 0, fat: 0, carbs: 0 }
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
            totalCarbs: 0
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
        totalCarbs: 0
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
                        weight: parsed.profile ? parsed.profile.weight : 0
                    });
                }

                // Reset dienos suvestinę
                parsed.consumedToday = {
                    date: today,
                    trainingKcal: 0,
                    items: [],
                    totalKcal: 0, totalProtein: 0, totalFat: 0, totalCarbs: 0
                };
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

    // --- PROFILIS IR SKAIČIAVIMAI ---
    setupProfileForm() {
        const form = document.getElementById('profileForm');

        // Funkcija, kuri paima duomenis ir perskaičiuoja
        const updateAndCalculate = () => {
            this.data.profile.gender = document.getElementById('gender').value;
            this.data.profile.age = parseFloat(document.getElementById('age').value) || 0;
            this.data.profile.height = parseFloat(document.getElementById('height').value) || 0;
            this.data.profile.weight = parseFloat(document.getElementById('weight').value) || 0;
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

        p.tdee = targetKcal;
        p.macros = { protein, fat, carbs };

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

        // Atnaujinam progress bar'us
        const pPercent = p.macros.protein ? Math.min((c.totalProtein / p.macros.protein) * 100, 100) : 0;
        const fPercent = p.macros.fat ? Math.min((c.totalFat / p.macros.fat) * 100, 100) : 0;
        const cPercent = p.macros.carbs ? Math.min((c.totalCarbs / p.macros.carbs) * 100, 100) : 0;

        document.querySelector('.protein-fill').style.width = `${pPercent}%`;
        document.querySelector('.fat-fill').style.width = `${fPercent}%`;
        document.querySelector('.carbs-fill').style.width = `${cPercent}%`;

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
            this.data.consumedToday.items = this.data.consumedToday.items.filter(i => i.id !== id);
            this.saveData();
            this.updateSummaryUI();
            this.renderTodayMeals();
        }
    },

    // --- PRODUKTŲ VALDYMAS ---
    setupAddFoodForm() {
        const form = document.getElementById('addProductForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const newFood = {
                id: Date.now(), // Unikalus ID
                name: document.getElementById('newFoodName').value,
                kcal: parseFloat(document.getElementById('newFoodKcal').value),
                protein: parseFloat(document.getElementById('newFoodProtein').value),
                fat: parseFloat(document.getElementById('newFoodFat').value),
                carbs: parseFloat(document.getElementById('newFoodCarbs').value)
            };

            this.data.foods.push(newFood);
            this.saveData();
            this.renderFoodsList();
            // Atnaujinti produktų iškrentantį sąrašą
            this.updateIngredientSelect();
            this.closeModal('addProductModal');
            form.reset();
        });

        // Search functionality
        document.getElementById('foodSearch').addEventListener('input', (e) => {
            this.renderFoodsList(e.target.value);
        });
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
                        100g: ${food.kcal} kcal | B: ${food.protein}g | R: ${food.fat}g | A: ${food.carbs}g
                    </div>
                </div>
                <div style="display: flex; gap: 5px;">
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

        const form = document.getElementById('addMealForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.tempMeal.ingredients.length === 0) return alert('Pridėkite bent vieną ingredientą!');

            const newMeal = {
                id: Date.now(),
                name: document.getElementById('mealName').value,
                ingredients: [...this.tempMeal.ingredients],
                totalWeight: this.tempMeal.totalWeight,
                kcal: this.tempMeal.totalKcal,
                protein: this.tempMeal.totalProtein,
                fat: this.tempMeal.totalFat,
                carbs: this.tempMeal.totalCarbs
            };

            this.data.meals.push(newMeal);
            this.saveData();
            this.renderMealsList();
            this.closeModal('addMealModal');

            // Atstatom laikinąjį
            this.tempMeal = { ingredients: [], totalWeight: 0, totalKcal: 0, totalProtein: 0, totalFat: 0, totalCarbs: 0 };
            document.getElementById('mealName').value = '';
            this.renderTempIngredients();
        });
    },

    updateIngredientSelect() {
        const select = document.getElementById('ingredientSelect');
        select.innerHTML = '<option value="">- Pasirinkti -</option>';
        // Surūšiuojam abėcėlės tvarka
        const sortedFoods = [...this.data.foods].sort((a, b) => a.name.localeCompare(b.name));
        sortedFoods.forEach(food => {
            const option = document.createElement('option');
            option.value = food.id;
            option.text = food.name;
            select.appendChild(option);
        });
    },

    addIngredientToMeal() {
        const select = document.getElementById('ingredientSelect');
        const weightInput = document.getElementById('ingredientWeight');
        const unitSelect = document.getElementById('ingredientUnit');

        const foodId = parseInt(select.value);
        const amount = parseFloat(weightInput.value);
        const unitMultiplier = parseFloat(unitSelect.value);

        if (!foodId || !amount || amount <= 0) {
            return alert('Pasirinkite produktą ir įveskite kiekį!');
        }

        const weightInGrams = amount * unitMultiplier;

        const food = this.data.foods.find(f => f.id === foodId);
        if (!food) return;

        // Skaičiuojame kiek gavosi iš pasirinkto svorio (proporcijos nuo 100g)
        const ratio = weightInGrams / 100;

        let displayAmountStr = `${amount} ${unitSelect.options[unitSelect.selectedIndex].text}`;

        const ingItem = {
            id: Date.now(), // unikolu laikinui sąrašui
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
        this.calculateTempMeal();
        this.renderTempIngredients();

        // Išvalom formą
        select.value = '';
        weightInput.value = '';
    },

    removeTempIngredient(id) {
        this.tempMeal.ingredients = this.tempMeal.ingredients.filter(i => i.id !== id);
        this.calculateTempMeal();
        this.renderTempIngredients();
    },

    calculateTempMeal() {
        let weight = 0, kcal = 0, protein = 0, fat = 0, carbs = 0;

        this.tempMeal.ingredients.forEach(i => {
            weight += i.weight;
            kcal += i.kcal;
            protein += i.protein;
            fat += i.fat;
            carbs += i.carbs;
        });

        this.tempMeal.totalWeight = weight;
        this.tempMeal.totalKcal = kcal;
        this.tempMeal.totalProtein = protein;
        this.tempMeal.totalFat = fat;
        this.tempMeal.totalCarbs = carbs;

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
            < div > ${i.name} (${i.weight}g)</div >
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

    renderMealsList() {
        const list = document.getElementById('mealsList');
        list.innerHTML = '';

        if (this.data.meals.length === 0) {
            list.innerHTML = '<li class="empty-state">Jūs dar nesukūrėte jokių patiekalų.</li>';
            return;
        }

        this.data.meals.forEach(meal => {
            const li = document.createElement('li');
            li.className = 'glass-card mt-10';
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';

            // Kiek 100g gaunasi kalorijų?
            const kcalPer100 = meal.totalWeight > 0 ? (meal.kcal / meal.totalWeight) * 100 : 0;

            li.innerHTML = `
            < div >
                    <strong>${meal.name}</strong>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                        Visas svoris: ${Math.round(meal.totalWeight)}g | Viso: ${Math.round(meal.kcal)} kcal<br>
                        <em>100g turi ~${Math.round(kcalPer100)} kcal</em>
                    </div>
                </div >
                <div style="display: flex; gap: 5px;">
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

        if (type === 'food') {
            item = this.data.foods.find(f => f.id === id);
            if (item) kcalRatio = item.kcal / 100;
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
        weightInput.value = '';
        unitSelect.value = '1';
        const calcSpan = document.getElementById('consumeCalcKcal');
        calcSpan.innerText = '0';

        // Dinaminis skaičiavimas rašant
        const calculateLive = () => {
            const amount = parseFloat(weightInput.value) || 0;
            const multiplier = parseFloat(unitSelect.value) || 1;
            const finalGrams = amount * multiplier;
            calcSpan.innerText = Math.round(finalGrams * kcalRatio);
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
            const amount = parseFloat(document.getElementById('consumeWeight').value);
            const unitSelect = document.getElementById('consumeUnit');
            const multiplier = parseFloat(unitSelect.value);

            if (!amount || amount <= 0) return;

            const weightInGrams = amount * multiplier;
            const displayAmountStr = `${amount} ${unitSelect.options[unitSelect.selectedIndex].text.split(' ')[0]}`;

            let sourceItem = null;
            let consumed = {
                id: Date.now(),
                weight: weightInGrams,
                displayAmount: displayAmountStr,
                timestamp: new Date().toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' })
            };
            let ratio = 0;

            if (type === 'food') {
                sourceItem = this.data.foods.find(f => f.id === id);
                if (sourceItem) ratio = weightInGrams / 100;
            } else {
                sourceItem = this.data.meals.find(m => m.id === id);
                if (sourceItem) ratio = weightInGrams / sourceItem.totalWeight;
            }

            if (!sourceItem) return;

            consumed.name = sourceItem.name;
            consumed.type = type;
            consumed.kcal = sourceItem.kcal * ratio;
            consumed.protein = sourceItem.protein * ratio;
            consumed.fat = sourceItem.fat * ratio;
            consumed.carbs = sourceItem.carbs * ratio;

            // Pridedam į dienos suvestinę
            const cT = this.data.consumedToday;
            cT.items.push(consumed);
            cT.totalKcal += consumed.kcal;
            cT.totalProtein += consumed.protein;
            cT.totalFat += consumed.fat;
            cT.totalCarbs += consumed.carbs;

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
                            B:${Math.round(item.protein)} R:${Math.round(item.fat)} A:${Math.round(item.carbs)}
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
        const weight = parseFloat(input.value);
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
        this.analyzeWeeklyInsights(periodData);
    },

    analyzeWeeklyInsights(periodData) {
        const list = document.getElementById('weeklyInsightsList');
        if (!list) return;

        list.innerHTML = '';
        const insights = [];

        if (!periodData || periodData.length < 3) {
            list.innerHTML = '<li class="empty-state">Per mažai dienų analizei. Fiksuokite duomenis bent 3 dienas.</li>';
            return;
        }

        let totalKcal = 0, totalP = 0, totalF = 0, totalC = 0;
        let successfulDays = 0;
        let cheatDays = 0;
        let lowestDeficitDay = 0; // fiksavimui per mažo valgymo

        const p = this.data.profile;

        periodData.forEach(r => {
            const kcal = r.totalKcal || 0;
            totalKcal += kcal;
            totalP += (r.totalProtein || 0);
            totalF += (r.totalFat || 0);
            totalC += (r.totalCarbs || 0);

            // Dinaminis tikslas (įskaitant asmeninį "eatBackCalories")
            const dynamicTDEE = (p.eatBackCalories !== false) ? r.tdee + (r.trainingKcal || 0) : r.tdee;
            const maintenance = r.tdee - (p.goal || 0) + (r.trainingKcal || 0); // Kiek gali suvalgyti kad neliestų svorio

            // Tikslo laikymasis (jei suvalgo ±150 kcal aplink tikslą arba net mažiau deficite)
            if (kcal > 0 && kcal <= dynamicTDEE + 150) {
                successfulDays++;
            }

            // Persivalgymo diena (viršijama palaikymo norma + 300 kcal)
            if (kcal > maintenance + 300) {
                cheatDays++;
            }
        });

        const daysWithRecords = periodData.filter(r => r.totalKcal > 0).length;
        if (daysWithRecords === 0) {
            list.innerHTML = '<li class="empty-state">Kol kas tuščia. Pridėkite suvalgyto maisto.</li>';
            return;
        }

        const avgKcal = totalKcal / daysWithRecords;

        // Procentinis makroelementų pasiskirstymas faktinis
        const pctP = ((totalP * 4) / totalKcal) * 100 || 0;
        const pctF = ((totalF * 9) / totalKcal) * 100 || 0;
        const pctC = ((totalC * 4) / totalKcal) * 100 || 0;

        // 1. Konsistencijos įžvalga
        if (successfulDays === periodData.length) {
            insights.push({ type: 'success', text: `<strong>Puikus pastovumas!</strong> Visas ${periodData.length} dienas iš eilės neviršijote savo tikslo. Taip ir toliau!` });
        } else if (cheatDays > 1) {
            insights.push({ type: 'danger', text: `<strong>Kalorijų šuoliai:</strong> Per šį laikotarpį net ${cheatDays} d. stipriai viršijote savo <em>palaikymo</em> normą. Tokie šuoliai gali "suvalgyti" visos savaitės jūsų sukauptą deficitą.` });
        }

        // 2. Baltymų analizė (Siekiamybė ~30%, arba bent > 1.2g/kg kūno svoriui)
        const avgP_grams = totalP / daysWithRecords;
        const gPerKg = avgP_grams / p.weight;

        if (gPerKg < 1.2 || pctP < 20) {
            insights.push({ type: 'warning', text: `<strong>Trūksta baltymų:</strong> Vidutiniškai surenkate tik ${pctP.toFixed(0)}% baltymų (norma ~30%). Dėl to galite jausti didesnį alkį ir prarasti raumenų masę. Pabandykite įtraukti daugiau kiaušinių, žuvies ar varškės.` });
        } else if (pctP > 40) {
            insights.push({ type: 'info', text: `<strong>Baltymų perteklius:</strong> Baltymai sudaro net ${pctP.toFixed(0)}%. Nors tai gerai sotumui, įsitikinkite, kad neaukojate naudingų riebalų ir angliavandenių.` });
        }

        // 3. Riebalų analizė (Siekiamybė ~30%, neturėtų kristi žemiau 20% hormonų sveikatai)
        if (pctF < 20) {
            insights.push({ type: 'warning', text: `<strong>Per mažai riebalų:</strong> Jūsų mityboje riebalai sudaro tik ${pctF.toFixed(0)}%. Kad išlaikytumėte sveiką hormonų foną, nevenkite sveikų riebalų (riešutai, avokadai, alyvuogių aliejus).` });
        } else if (pctF > 40) {
            insights.push({ type: 'danger', text: `<strong>Per daug riebalų:</strong> Riebalai suvalgo didžiąją dalį jūsų kalorijų (vid. ${pctF.toFixed(0)}%). Dėl šios priežasties maisto tūris lėkštėje būna mažesnis, kas greičiau iššaukia netikėto alkio priepuolius.` });
        }

        // 4. Angliavandenių analizė (Siekiamybė ~40%)
        if (pctC > 55) {
            insights.push({ type: 'warning', text: `<strong>Dominuoja angliavandeniai:</strong> Jūsų mityba labai angliavandeninė (${pctC.toFixed(0)}%). Jei trūksta energijos rytais, pabandykite dalį jų pakeisti į sotumą suteikiančius baltymus.` });
        } else if (pctC < 20) {
            // Galbūt keto dieta
            insights.push({ type: 'info', text: `<strong>Mažai angliavandenių:</strong> Renkate labai mažai angliavandenių (${pctC.toFixed(0)}%). Jei treniruotės sunkios ir jaučiatės išsekę, angliavandenių padidinimas gali grąžinti energiją.` });
        }

        // Atvaizduojame UI
        if (insights.length === 0) {
            list.innerHTML = '<li class="empty-state" style="color:var(--success)">Viskas atrodo puikiai! Didelių trūkumų ar nukrypimų neradome.</li>';
            return;
        }

        insights.forEach(ins => {
            const li = document.createElement('li');
            li.style.background = 'rgba(0,0,0,0.2)';
            li.style.padding = '12px';
            li.style.marginBottom = '10px';
            li.style.borderRadius = '8px';
            li.style.fontSize = '14px';
            li.style.borderLeft = `4px solid var(--${ins.type})`; // Spalva pagal tipą (success, danger, warning)

            li.innerHTML = ins.text;
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

    // --- IŠORINĖ API (OpenFoodFacts) INTERGRACIJA ---
    setupOnlineSearch() {
        const btn = document.getElementById('onlineSearchBtn');
        const input = document.getElementById('onlineSearchInput');

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchOpenFoodFacts(input.value);
        });

        btn.addEventListener('click', () => {
            this.searchOpenFoodFacts(input.value);
        });
    },

    searchOpenFoodFacts(query) {
        if (!query || query.trim().length === 0) return;

        const loader = document.getElementById('onlineLoader');
        const list = document.getElementById('onlineSearchResults');

        loader.classList.remove('hidden');
        list.innerHTML = '';

        // Formuojame Open Food Facts Užklausą. page_size apriboja rezultatų skaičių
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=15`;

        fetch(url)
            .then(res => res.json())
            .then(data => {
                loader.classList.add('hidden');

                if (!data.products || data.products.length === 0) {
                    list.innerHTML = '<li class="empty-state">Rezultatų nerasta. Bandykite anglišką žodį arba kitą pavadinimą.</li>';
                    return;
                }

                this.renderOnlineSearchResults(data.products);
            })
            .catch(err => {
                loader.classList.add('hidden');
                list.innerHTML = '<li class="empty-state" style="color:var(--danger)">Įvyko klaida jungiantis prie duomenų bazės. Patikrinkite interneto ryšį.</li>';
                console.error('API Error:', err);
            });
    },

    renderOnlineSearchResults(products) {
        const list = document.getElementById('onlineSearchResults');
        list.innerHTML = '';

        // Prafiltruojame rezultatus, imame tik tuos, kurie turi energetinę vertę
        const validProducts = [];
        products.forEach(p => {
            const nutriments = p.nutriments || {};
            // bandom rasti kcal
            let kcal = nutriments['energy-kcal_100g'];
            if (kcal === undefined && nutriments['energy_100g']) {
                kcal = nutriments['energy_100g'] / 4.184; // paversti is kJ į Kcal
            }
            if (kcal !== undefined && kcal >= 0) {
                validProducts.push({ p, kcal });
            }
        });

        if (validProducts.length === 0) {
            list.innerHTML = '<li class="empty-state">Rasti produktai sistemoje neturi maistingumo informacijos.</li>';
            return;
        }

        validProducts.forEach(item => {
            const p = item.p;
            const kcal = Math.round(item.kcal);
            const name = p.product_name || p.generic_name || 'Nežinomas produktas';
            const brand = p.brands ? `(${p.brands.split(',')[0]})` : '';

            const nutriments = p.nutriments || {};
            const protein = Math.round(nutriments.proteins_100g || 0);
            const fat = Math.round(nutriments.fat_100g || 0);
            const carbs = Math.round(nutriments.carbohydrates_100g || 0);

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
                        100g: <strong>${kcal} kcal</strong> | B: ${protein}g | R: ${fat}g | A: ${carbs}g
                    </div>
                </div>
                <button class="btn btn-primary" style="font-size:12px; padding: 6px; background: var(--success);" onclick="app.importOnlineFood('${safeNameStr}', ${kcal}, ${protein}, ${fat}, ${carbs})">
                    <span class="material-icons-round" style="font-size:16px;">download</span> Išsaugoti pas mane
                </button>
            `;
            list.appendChild(li);
        });
    },

    importOnlineFood(encodedName, kcal, protein, fat, carbs) {
        const name = decodeURIComponent(encodedName);
        const newFood = {
            id: Date.now(),
            name: name,
            kcal: kcal,
            protein: protein,
            fat: fat,
            carbs: carbs
        };

        // Išsaugome mūsų duomenų bazėje
        this.data.foods.push(newFood);
        this.saveData();

        // Atnaujinam UI vaizdus
        this.renderFoodsList();
        this.updateIngredientSelect();

        this.closeModal('searchOnlineModal');
        alert(`Produktas "${name}" sėkmingai atsiųstas ir išsaugotas į jūsų sąrašą!`);
    }

};

// Paleisti programą užsikrovus
window.addEventListener('DOMContentLoaded', () => {
    app.init();
});
