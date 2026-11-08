import { supabaseClient } from './supabase-client.js';

// ===== Сортирует фотографии товара так, чтобы первой была обложка =====
function getProductPhotos(product) {
  return (product.product_images || []).slice().sort(function (first, second) {
    return first.sort_order - second.sort_order;
  });
}

// Возвращает true, если товар добавили менее семи дней назад.
function isNewProduct(createdAt) {
  const createdTime = Date.parse(createdAt);
  const age = Date.now() - createdTime;
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  return Number.isFinite(createdTime) && age >= 0 && age < oneWeek;
}

// ===== Создаёт одну карточку из данных товара, полученных из базы =====
function createProductCard(product, headingTag) {
  const card = document.createElement('article');
  const groupName = product.product_groups ? product.product_groups.name : '';
  const coverImage = getProductPhotos(product)[0];
  const searchableText = [product.name, product.size, product.description, groupName].filter(Boolean).join(' ').toLowerCase();
  const createdAt = new Date(product.created_at).getTime();
  card.className = 'card catalog-product reveal';
  card.dataset.groupId = String(product.group_id);
  card.dataset.name = searchableText;
  card.dataset.price = String(Number(product.price));
  card.dataset.order = String(Number.isFinite(createdAt) ? createdAt : 0);

  const imageWrap = document.createElement('div');
  imageWrap.className = 'card__image-wrap';

  const imageLink = document.createElement('a');
  imageLink.className = 'card__image-link';
  imageLink.href = 'product.html?id=' + encodeURIComponent(product.id);
  imageLink.setAttribute('aria-label', 'Открыть товар ' + product.name);

  if (coverImage) {
    const image = document.createElement('img');
    image.className = 'card__image';
    image.src = coverImage.url;
    image.alt = product.name;
    image.loading = 'lazy';
    imageLink.appendChild(image);
  } else {
    const noPhoto = document.createElement('span');
    noPhoto.className = 'catalog-product__no-photo';
    noPhoto.textContent = 'ФОТО НЕ ДОБАВЛЕНО';
    imageLink.appendChild(noPhoto);
  }
  imageWrap.appendChild(imageLink);

  if (isNewProduct(product.created_at)) {
    const badge = document.createElement('span');
    badge.className = 'card__badge';
    badge.textContent = 'NEW';
    imageWrap.appendChild(badge);
  }

  const details = document.createElement('div');
  details.className = 'card__details';

  const title = document.createElement(headingTag || 'h2');
  title.className = 'card__title';
  title.textContent = product.name;

  const description = document.createElement('p');
  description.className = 'card__variant';
  description.textContent = product.size ? 'Размер ' + product.size : groupName;

  const footer = document.createElement('div');
  footer.className = 'card__footer';

  const price = document.createElement('p');
  price.className = 'card__price';
  price.textContent = Number(product.price).toLocaleString('ru-RU') + ' MDL';

  const arrow = document.createElement('a');
  arrow.className = 'card__arrow';
  arrow.href = imageLink.href;
  arrow.setAttribute('aria-label', 'Подробнее о товаре ' + product.name);
  arrow.textContent = '→';

  footer.append(price, arrow);
  details.append(title, description, footer);
  card.append(imageWrap, details);
  return card;
}

// Наполняет список категорий названиями, полученными из справочника базы данных.
function fillCategoryFilter(select, categories) {
  if (!select) return;

  const options = [new Option('ВСЕ КАТЕГОРИИ', 'all')];
  categories.forEach(function (category) {
    options.push(new Option(category.name, String(category.id)));
  });
  select.replaceChildren(...options);
}

// ===== Фильтрует, ищет, сортирует и обновляет счётчик карточек =====
function initCatalogControls(grid, products, categorySelect, searchInput, sortSelect, countLabel, message) {
  let activeGroupId = 'all';

  // Применяет категорию, поиск и сортировку к уже созданным карточкам.
  function updateCatalog() {
    const searchText = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const sortOrder = sortSelect ? sortSelect.value : 'newest';
    const visibleCards = products.filter(function (card) {
      const matchesCategory = activeGroupId === 'all' || card.dataset.groupId === activeGroupId;
      const matchesSearch = card.dataset.name.includes(searchText);
      card.hidden = !(matchesCategory && matchesSearch);
      return !card.hidden;
    });

    visibleCards.sort(function (first, second) {
      if (sortOrder === 'price-low') return Number(first.dataset.price) - Number(second.dataset.price);
      if (sortOrder === 'price-high') return Number(second.dataset.price) - Number(first.dataset.price);
      return Number(second.dataset.order) - Number(first.dataset.order);
    });
    visibleCards.forEach(function (card) { grid.appendChild(card); });
    if (countLabel) countLabel.textContent = 'Найдено товаров: ' + visibleCards.length;
    if (message) {
      message.textContent = searchText
        ? 'По вашему запросу ничего не найдено.'
        : activeGroupId === 'all'
          ? 'Сейчас нет товаров в наличии.'
          : 'В этой категории пока нет товаров в наличии.';
      message.hidden = visibleCards.length > 0;
    }
  }

  if (categorySelect) categorySelect.addEventListener('change', function () {
    activeGroupId = categorySelect.value;
    updateCatalog();
  });
  if (searchInput) searchInput.addEventListener('input', updateCatalog);
  if (sortSelect) sortSelect.addEventListener('change', updateCatalog);
  updateCatalog();
}

// ===== Анимирует появление карточек после их загрузки из базы =====
function animateProductCards(container, cards) {
  if (!container || !cards.length) return;

  const reduceMotion = window.matchMedia('(max-width: 1024px), (prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    cards.forEach(function (card) { card.classList.add('visible'); });
    return;
  }

  if (window.gsap && window.ScrollTrigger) {
    window.gsap.registerPlugin(window.ScrollTrigger);
    document.documentElement.classList.add('gsap-ready');
    window.gsap.fromTo(cards,
      { autoAlpha: 0, y: 18 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.72,
        stagger: 0.1,
        ease: 'power2.out',
        scrollTrigger: { trigger: container, start: 'top 86%', once: true },
        onComplete: function () {
          cards.forEach(function (card) { card.classList.add('visible'); });
        }
      }
    );
    return;
  }

  if (!('IntersectionObserver' in window)) {
    cards.forEach(function (card) { card.classList.add('visible'); });
    return;
  }

  const observer = new IntersectionObserver(function (entries, currentObserver) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      currentObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  cards.forEach(function (card) { observer.observe(card); });
}

// ===== Загружает опубликованные товары для каталога и главного экрана =====
async function loadStorefrontProducts() {
  const catalog = document.querySelector('.catalog-page');
  const catalogGrid = catalog ? catalog.querySelector('#catalog-list') : null;
  const catalogMessage = catalog ? catalog.querySelector('#catalog-message') : null;
  const countLabel = catalog ? catalog.querySelector('#catalog-count') : null;
  const homeGrid = document.querySelector('#products-list');
  const homeMessage = document.querySelector('#home-products-message');
  if (!catalogGrid && !homeGrid) return;

  if (!supabaseClient) {
    if (catalogMessage) catalogMessage.textContent = 'Не удалось подключиться к каталогу. Проверь подключение Supabase.';
    if (homeMessage) homeMessage.textContent = 'Не удалось загрузить товары. Проверь подключение Supabase.';
    return;
  }

  try {
    const productQuery = supabaseClient
      .from('products')
      .select('id, group_id, name, size, description, price, quantity, is_published, created_at, product_groups(name), product_images(url, sort_order)')
      .eq('is_published', true)
      .gt('quantity', 0)
      .order('created_at', { ascending: false })
      .order('sort_order', { referencedTable: 'product_images', ascending: true });
    const categoriesQuery = catalogGrid
      ? supabaseClient.from('product_groups').select('id, name').order('name')
      : Promise.resolve({ data: [], error: null });
    const results = await Promise.all([productQuery, categoriesQuery]);
    const productResult = results[0];
    const categoriesResult = results[1];
    if (productResult.error) throw productResult.error;
    if (categoriesResult.error) throw categoriesResult.error;
    const data = productResult.data || [];

    if (catalogGrid) {
      const categorySelect = catalog.querySelector('#catalog-category');
      const searchInput = catalog.querySelector('#catalog-search');
      const sortSelect = catalog.querySelector('#catalog-sort');
      fillCategoryFilter(categorySelect, categoriesResult.data || []);
      const catalogCards = data.map(function (product) { return createProductCard(product, 'h2'); });
      catalogGrid.replaceChildren(...catalogCards);
      animateProductCards(catalogGrid, catalogCards);
      initCatalogControls(catalogGrid, catalogCards, categorySelect, searchInput, sortSelect, countLabel, catalogMessage);
    }

    if (homeGrid && data.length) {
      const homeCards = data.slice(0, 4).map(function (product) { return createProductCard(product, 'h3'); });
      homeGrid.replaceChildren(...homeCards);
      if (homeMessage) homeMessage.hidden = true;
      animateProductCards(homeGrid, homeCards);
    } else if (homeGrid) {
      homeGrid.replaceChildren();
      if (homeMessage) homeMessage.textContent = 'Новых поступлений пока нет.';
    }
  } catch (error) {
    if (catalogGrid) catalogGrid.replaceChildren();
    if (homeGrid) homeGrid.replaceChildren();
    const messageText = error.message
      ? 'Не удалось загрузить товары. ' + error.message
      : 'Не удалось загрузить товары. Проверь соединение и настройки Supabase.';
    if (catalogMessage) catalogMessage.textContent = messageText;
    if (homeMessage) homeMessage.textContent = messageText;
  }
}

// ===== Запускает загрузку после готовности страницы =====
document.addEventListener('DOMContentLoaded', loadStorefrontProducts);
