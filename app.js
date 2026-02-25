import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://zuupkhhvcrjzwkgwwtgz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1dXBraGh2Y3JqendrZ3d3dGd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDg3MTcsImV4cCI6MjA4NzUyNDcxN30.KJiStEORy4v9egIiPsbK5qy_KS4GPwYSypFEZ3494zw'
const supabase = createClient(supabaseUrl, supabaseKey)

// --- FUNÇÃO NORMALIZAR NOMES ---
function normalize(str) {
  return str
    .trim()
    .normalize("NFD")                 // separa acentos
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase();
}

// --- CACHE DE DIST_BARES ---
let distBaresCache = [];

async function carregarDistBares() {
  const { data, error } = await supabase
    .from("dist_bares")
    .select("bar, lat, lng");

  if (error) {
    console.error("Erro ao carregar dist_bares:", error);
    distBaresCache = [];
  } else {
    distBaresCache = data;

    // Mostrar a localização de todos os bares no console
    distBaresCache.forEach(b => {
      console.log(`${b.bar} - Lat: ${b.lat}, Lng: ${b.lng}`);
    });
  }
}

// --- FUNÇÃO ADICIONAR OU ATUALIZAR PREÇO ---
window.adicionarPreco = async function () {
  const produtoSelect = document.getElementById("produto");
  const barInput = document.getElementById("bar");
  const precoInput = document.getElementById("preco");

  const produto = produtoSelect.value.trim();
  const bar = barInput.value.trim();
  const preco = parseFloat(precoInput.value);

  if (!produto || !bar || isNaN(preco)) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  const { error } = await supabase
    .from("bares")
    .upsert(
      [{ produto, bar, preco }],
      { onConflict: ["produto", "bar"] }
    );

  if (error) {
    console.log("Erro ao salvar preço:", error);
    alert("Erro ao salvar/atualizar preço!");
  } else {
    alert("Preço salvo/atualizado com sucesso!");
    precoInput.value = "";
    barInput.value = "";
    produtoSelect.value = "";
  }
};

// --- FUNÇÃO CALCULAR DISTÂNCIA ---
function calcularDistancia(lat1, lng1, lat2, lng2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) *
    Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLng/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// --- FUNÇÃO BUSCAR PREÇOS COM DISTÂNCIA ---
window.buscarPreco = async function () {
  const buscaSelect = document.getElementById("buscaProduto");
  const resultadoDiv = document.getElementById("resultado");

  if (!buscaSelect || !resultadoDiv) return;

  const produto = buscaSelect.value.trim();
  if (!produto) {
    alert("Selecione um produto");
    return;
  }
  console.log("Produto buscado:", produto);

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const userLat = pos.coords.latitude;
    const userLng = pos.coords.longitude;
    console.log("Sua localização:", userLat, userLng);

    // Buscar preços do produto
    const { data: bares, error } = await supabase
      .from("bares")
      .select("bar, produto, preco")
      .eq("produto", produto);

    if (error) {
      console.log("Erro ao buscar preços:", error);
      resultadoDiv.innerHTML = "Erro ao buscar preços.";
      return;
    }

    if (!bares || bares.length === 0) {
      resultadoDiv.innerHTML = "Nenhum preço encontrado.";
      return;
    }

    // Junta preços com localização a partir do cache
    const baresComDistancia = bares.map(item => {
      const dist = distBaresCache.find(d => normalize(d.bar) === normalize(item.bar));
      let distancia = null;
      if (dist && dist.lat != null && dist.lng != null) {
        const lat = Number(dist.lat);
        const lng = Number(dist.lng);
        distancia = calcularDistancia(userLat, userLng, lat, lng);
      }
      return { ...item, distancia };
    });

    // Ordena por distância se disponível, senão por preço
    baresComDistancia.sort((a, b) => {
      if (a.distancia != null && b.distancia != null) return a.distancia - b.distancia;
      return a.preco - b.preco;
    });

    // Exibe resultados
    let html = "";
    baresComDistancia.forEach((item, idx) => {
      const distText = item.distancia != null ? ` - ${item.distancia.toFixed(2)} km` : "";
      html += idx === 0
        ? `<p style="color: green; font-weight: bold;">🏆 ${item.bar} - R$ ${item.preco.toFixed(2)}${distText}</p>`
        : `<p>${item.bar} - R$ ${item.preco.toFixed(2)}${distText}</p>`;
    });

    resultadoDiv.innerHTML = html;

  }, async (err) => {
    console.error("Erro ao pegar localização:", err);
    alert("Não foi possível obter sua localização. Mostrando preços sem distância.");

    const { data: bares } = await supabase
      .from("bares")
      .select("bar, produto, preco")
      .eq("produto", produto);

    const html = bares.map(item => `<p>${item.bar} - R$ ${item.preco.toFixed(2)}</p>`).join("");
    resultadoDiv.innerHTML = html || "Nenhum preço encontrado.";
  });
};

// --- CARREGA DIST_BARES AO ABRIR A PÁGINA ---
carregarDistBares();
