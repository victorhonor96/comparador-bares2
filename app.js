import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://zuupkhhvcrjzwkgwwtgz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1dXBraGh2Y3JqendrZ3d3dGd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDg3MTcsImV4cCI6MjA4NzUyNDcxN30.KJiStEORy4v9egIiPsbK5qy_KS4GPwYSypFEZ3494zw'
const supabase = createClient(supabaseUrl, supabaseKey)

// Cache para dist_bares
let distBaresCache = []

// Normaliza nomes para comparação
function normalize(str) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

/*----------------------
  Botão 1: Adicionar/Atualizar Preço
----------------------*/
async function adicionarPreco() {
  const produtoEl = document.getElementById("produto")
  const barEl = document.getElementById("bar")
  const precoEl = document.getElementById("preco")

  const produto = produtoEl.value
  const bar = barEl.value
  const preco = parseFloat(precoEl.value)

  if (!produto || !bar || isNaN(preco)) {
    alert("Preencha todos os campos corretamente!")
    return
  }

  // Upsert no Supabase (produto + bar)
  const { data, error } = await supabase
    .from("bares")
    .upsert({ produto, bar, preco }, { onConflict: ['produto', 'bar'] })
    .select()

  if (error) {
    console.error("Erro ao inserir/atualizar:", error)
    alert("Erro ao salvar preço.")
    return
  }

  alert(`Preço do produto "${produto}" no bar "${bar}" atualizado com sucesso!`)
}

/*----------------------
  Botão 2: Buscar Produto
----------------------*/
async function buscarPreco() {
  const produtoEl = document.getElementById("buscaProduto")
  const produto = produtoEl.value

  if (!produto) {
    alert("Selecione um produto!")
    return
  }

  // Carrega dist_bares se ainda não estiver
  if (!distBaresCache || distBaresCache.length === 0) {
    const { data: distData, error: distError } = await supabase
      .from("dist_bares")
      .select("*")
    if (distError) {
      console.error(distError)
      alert("Erro ao carregar dist_bares")
      return
    }
    distBaresCache = distData
  }

  // Pega preços do produto
  const { data: precos, error: precoError } = await supabase
    .from("bares")
    .select("*")
    .eq("produto", produto)

  if (precoError) {
    console.error(precoError)
    return
  }

  // Pega sua localização
  navigator.geolocation.getCurrentPosition(pos => {
    const minhaLat = pos.coords.latitude
    const minhaLng = pos.coords.longitude

    const resultadoDiv = document.getElementById("resultado")
    resultadoDiv.innerHTML = ""

    if (precos.length === 0) {
      resultadoDiv.innerHTML = "<p>Nenhum preço encontrado.</p>"
      return
    }

    // Mapeia cada preço com distância
    const precosComDistancia = precos.map(p => {
      const barCoord = distBaresCache.find(d => normalize(d.bar) === normalize(p.bar))
      let distancia = null
      if (barCoord) {
        // Haversine
        const R = 6371
        const dLat = (barCoord.lat - minhaLat) * Math.PI / 180
        const dLng = (barCoord.lng - minhaLng) * Math.PI / 180
        const a = Math.sin(dLat/2)**2 + Math.cos(minhaLat*Math.PI/180)*Math.cos(barCoord.lat*Math.PI/180)*Math.sin(dLng/2)**2
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
        distancia = (R * c).toFixed(2)
      }
      return { ...p, distancia }
    })

    // Ordena por preço e depois distância
    precosComDistancia.sort((a, b) => {
      if (a.preco !== b.preco) return a.preco - b.preco
      return (a.distancia || 9999) - (b.distancia || 9999)
    })

    // Mostra no HTML
    precosComDistancia.forEach(p => {
      const barCoord = distBaresCache.find(d => normalize(d.bar) === normalize(p.bar))
      const lat = barCoord ? barCoord.lat : "N/A"
      const lng = barCoord ? barCoord.lng : "N/A"
      const div = document.createElement("div")
      div.innerHTML = `
        <strong>${p.bar}</strong> - R$ ${p.preco.toFixed(2)} - Distância: ${p.distancia ? p.distancia + ' km' : 'N/A'}<br>
        <em>Lat: ${lat}, Lng: ${lng}</em><br>
        <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank">Google Maps</a> |
        <a href="https://waze.com/ul?ll=${lat},${lng}&navigate=yes" target="_blank">Waze</a> |
        <a href="https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}" target="_blank">Uber</a>
      `
      resultadoDiv.appendChild(div)
      resultadoDiv.appendChild(document.createElement("hr"))
    })

  }, err => {
    alert("Erro ao obter localização: " + err.message)
  })
}

/*----------------------
  Botão 3: Mostrar todos os bares
----------------------*/
async function mostrarDistancias() {
  // Carrega dist_bares
  if (!distBaresCache || distBaresCache.length === 0) {
    const { data: distData, error: distError } = await supabase
      .from("dist_bares")
      .select("*")
    if (distError) {
      console.error(distError)
      alert("Erro ao carregar dist_bares")
      return
    }
    distBaresCache = distData
    console.log("Bares carregados no cache:", distBaresCache)
  }

  navigator.geolocation.getCurrentPosition(pos => {
    const minhaLat = pos.coords.latitude
    const minhaLng = pos.coords.longitude
    console.log("Sua localização:", minhaLat, minhaLng)

    const resultadoDiv = document.getElementById("resultado")
    resultadoDiv.innerHTML = ""

    distBaresCache.forEach(bar => {
      let distancia = null
      if (minhaLat && minhaLng && bar.lat && bar.lng) {
        const R = 6371
        const dLat = (bar.lat - minhaLat) * Math.PI / 180
        const dLng = (bar.lng - minhaLng) * Math.PI / 180
        const a = Math.sin(dLat/2)**2 + Math.cos(minhaLat*Math.PI/180)*Math.cos(bar.lat*Math.PI/180)*Math.sin(dLng/2)**2
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
        distancia = (R * c).toFixed(2)
      }

      const div = document.createElement("div")
      div.innerHTML = `
        <strong>${bar.bar}</strong> - Distância: ${distancia ? distancia + ' km' : 'N/A'}<br>
        <em>Lat: ${bar.lat}, Lng: ${bar.lng}</em><br>
        <a href="https://www.google.com/maps/search/?api=1&query=${bar.lat},${bar.lng}" target="_blank">Google Maps</a> |
        <a href="https://waze.com/ul?ll=${bar.lat},${bar.lng}&navigate=yes" target="_blank">Waze</a> |
        <a href="https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${bar.lat}&dropoff[longitude]=${bar.lng}" target="_blank">Uber</a>
      `
      resultadoDiv.appendChild(div)
      resultadoDiv.appendChild(document.createElement("hr"))
    })

  }, err => {
    alert("Erro ao obter localização: " + err.message)
  })
}

// Exporta funções para o HTML
window.adicionarPreco = adicionarPreco
window.buscarPreco = buscarPreco
window.mostrarDistancias = mostrarDistancias
