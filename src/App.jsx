import { useState, useEffect } from "react";

// Variable dinámica: Usará el URL público en Vercel, o localhost si estás programando.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function App() {
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [enCheckout, setEnCheckout] = useState(false);

  // === NUEVO: ESTADO Y CONTROL DEL HISTORIAL DEL NAVEGADOR ===
  const [vistaLegal, setVistaLegal] = useState(false);
  useEffect(() => {
    const manejarBotonAtras = () => {
      // Si el usuario presiona la flecha de "Atrás" en su navegador, cerramos la vista
      setVistaLegal(false);
      // Extra: también podemos aprovechar para cerrar el checkout si estaba ahí
      setEnCheckout(false);
    };
    window.addEventListener("popstate", manejarBotonAtras);
    return () => window.removeEventListener("popstate", manejarBotonAtras);
  }, []);

  // Función para abrir la vista y crear un "paso falso" en el historial
  const abrirVistaLegal = () => {
    window.history.pushState({ pagina: "legal" }, "");
    setVistaLegal(true);
    window.scrollTo(0, 0);
  };
  // ==========================================================
  const [slideActual, setSlideActive] = useState(0);
  const [nombreCliente, setNombreCliente] = useState("");
  const [apellidoCliente, setApellidoCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState(""); // <--- NUEVO

  const [configTienda, setConfigTienda] = useState({
    nombreTienda: "Cargando Tienda...",
    mensajeBanner: "Preparando ofertas...",
    descripcionBanner: "Por favor espera un momento...",
    correoTienda: "",
    whatsappTienda: "",
    politicaReembolso: "", // <-- NUEVO
    terminosServicio: "", // <-- NUEVO
  });

  // ESTADOS DEL CARRITO Y BASE DE DATOS
  const [carrito, setCarrito] = useState([]);
  const [procesando, setProcesando] = useState(false);
  const [productos, setProductos] = useState([]);
  const [cargandoProductos, setCargandoProductos] = useState(true);
  const [categorias, setCategorias] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState("TODAS"); // "TODAS" será la vista por defecto

  // === NUEVOS ESTADOS PARA EL BUSCADOR ===
  const [mostrarBuscador, setMostrarBuscador] = useState(false);
  const [busquedaTienda, setBusquedaTienda] = useState("");
  // === CERRAR BUSCADOR AL HACER CLIC AFUERA ===
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (mostrarBuscador && !event.target.closest("#contenedor-buscador")) {
        setMostrarBuscador(false);
        setBusquedaTienda("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mostrarBuscador]);

  const theme = {
    bg: "#f8f9fa",
    white: "#ffffff",
    text: "#212529",
    textMuted: "#6c757d",
    primary: "#7c3aed",
    blue: "#0d6efd",
    green: "#198754",
    red: "#dc3545",
    border: "#e5e7eb",
    footerBg: "#f1f3f5",
  };

  // =========================================
  // 1. OBTENER PRODUCTOS Y CONFIGURACIÓN
  // =========================================
  const fetchTiendaData = async () => {
    try {
      const pathParts = window.location.pathname.split("/");
      const usuarioId = pathParts[pathParts.length - 1];

      if (!usuarioId) throw new Error("ID de tienda no encontrado en la URL");

      // A) Traer los productos
      const resProd = await fetch(
        `${API_URL}/api/tienda/${usuarioId}/productos`,
      );
      if (resProd.ok) {
        const dataProd = await resProd.json();
        // ESTANDARIZACIÓN DE PRECIOS DESDE EL ORIGEN
        const productosNormalizados = dataProd.map((p) => ({
          ...p,
          precioOriginal: p.precioVenta,
          precioVenta:
            p.precioOferta && p.precioOferta > 0
              ? p.precioOferta
              : p.precioVenta,
        }));
        setProductos(productosNormalizados);
      }

      // B) Traer la configuración de la tienda
      const resConfig = await fetch(
        `${API_URL}/api/tienda/${usuarioId}/config`,
      );
      if (resConfig.ok) {
        const dataConfig = await resConfig.json();
        setConfigTienda({
          nombreTienda: dataConfig.nombreTienda || "Mi Tienda Virtual",
          mensajeBanner:
            dataConfig.mensajeBanner ||
            "¡Bienvenido a nuestra Tienda en Línea!",
          descripcionBanner:
            dataConfig.descripcionBanner ||
            "Personaliza este banner desde tu panel de administración en la sección Mi Tienda Web.",
          correoTienda: dataConfig.correoTienda || "",
          whatsappTienda: dataConfig.whatsappTienda || "",
          politicaReembolso: dataConfig.politicaReembolso || "",
          terminosServicio: dataConfig.terminosServicio || "",
        });
      }

      // C) Traer las categorías
      const resCat = await fetch(
        `${API_URL}/api/tienda/${usuarioId}/categorias`,
      );
      if (resCat.ok) {
        const dataCat = await resCat.json();
        setCategorias(dataCat);
      }
    } catch (error) {
      console.error("Error conectando con la base de datos:", error);
    } finally {
      setCargandoProductos(false);
    }
  };

  useEffect(() => {
    fetchTiendaData();
  }, []);

  // Generar ofertas reales tomando únicamente los productos que tienen una oferta activa en el gestor
  const productosOferta = productos.filter(
    (p) => p.precioOferta && p.precioOferta > 0,
  );

  // =========================================
  // 2. LÓGICA DEL CARRITO
  // =========================================
  const totalArticulos = carrito.reduce(
    (acc, item) => acc + item.cantidadSeleccionada,
    0,
  );
  const subtotalCarrito = carrito.reduce(
    (acc, item) => acc + item.precioVenta * item.cantidadSeleccionada,
    0,
  );

  // LÓGICA DE CATEGORÍAS Y BÚSQUEDA (VISTA DINÁMICA)
  const productosAMostrar = productos
    .filter(
      (p) => categoriaActiva === "TODAS" || p.categoria === categoriaActiva,
    )
    .filter((p) => {
      const busqueda = busquedaTienda.toLowerCase();
      const coincideNombre = p.nombre.toLowerCase().includes(busqueda);
      const coincideDesc = p.descripcion
        ? p.descripcion.toLowerCase().includes(busqueda)
        : false;
      return coincideNombre || coincideDesc;
    });

  const agregarAlCarrito = (producto) => {
    // Validación 1: Verificar el stock antes de hacer nada
    const existe = carrito.find((item) => item._id === producto._id);
    if (existe && existe.cantidadSeleccionada >= producto.stock) {
      alert(
        `⚠️ Stock insuficiente: Solo hay ${producto.stock} unidades disponibles de ${producto.nombre}.`,
      );
      return; // Detenemos la función aquí
    }

    setCarrito((prev) => {
      const existeInterno = prev.find((item) => item._id === producto._id);
      if (existeInterno) {
        return prev.map((item) =>
          item._id === producto._id
            ? { ...item, cantidadSeleccionada: item.cantidadSeleccionada + 1 }
            : item,
        );
      }
      return [{ ...producto, cantidadSeleccionada: 1 }, ...prev];
    });
    setCarritoAbierto(true);
  };

  const modificarCantidad = (id, delta) => {
    // Validación 2: Verificar stock cuando se suma desde dentro del carrito
    const item = carrito.find((i) => i._id === id);
    if (item && delta > 0 && item.cantidadSeleccionada + delta > item.stock) {
      alert(
        `⚠️ Stock insuficiente: Solo hay ${item.stock} unidades disponibles de ${item.nombre}.`,
      );
      return; // Detenemos la función aquí
    }

    setCarrito((prev) =>
      prev.map((item) => {
        if (item._id === id) {
          const nuevaCantidad = item.cantidadSeleccionada + delta;
          if (nuevaCantidad > 0 && nuevaCantidad <= item.stock) {
            return { ...item, cantidadSeleccionada: nuevaCantidad };
          }
        }
        return item;
      }),
    );
  };

  const eliminarDelCarrito = (id) => {
    setCarrito((prev) => prev.filter((item) => item._id !== id));
  };

  // =========================================
  // 3. CONEXIÓN CON API DE VENTAS (Ruta Dinámica)
  // =========================================
  const procesarCompra = async (e) => {
    if (e) e.preventDefault();
    if (carrito.length === 0) return;
    setProcesando(true);

    // Extraemos el ID de la tienda desde la URL nuevamente
    const pathParts = window.location.pathname.split("/");
    const usuarioId = pathParts[pathParts.length - 1];

    try {
      const promesasCompra = carrito.map((item) =>
        fetch(`${API_URL}/api/tienda/${usuarioId}/compra`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productoId: item._id,
            cantidad: item.cantidadSeleccionada,
            cliente: `${nombreCliente} ${apellidoCliente}`.trim(),
            telefonoCliente: telefonoCliente.trim(), // <--- ENVIAMOS EL TELÉFONO AL BACKEND
            origenVenta: "Web",
          }),
        }).then(async (res) => {
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(
              errorData.error || `Error en producto ${item.nombre}`,
            );
          }
          return res.json();
        }),
      );
      await Promise.all(promesasCompra);

      // ALERTA NUEVA Y LIMPIA (Cero redirección para el cliente)
      alert(
        "¡Pedido completado con éxito! Nos pondremos en contacto contigo por WhatsApp para coordinar la entrega y el pago.",
      );

      // Limpiamos todo al terminar
      setCarrito([]);
      setEnCheckout(false);
      setTelefonoCliente("");
      await fetchTiendaData();
    } catch (error) {
      alert("Hubo un error al procesar la compra: " + error.message);
      console.error(error);
    } finally {
      setProcesando(false);
    }
  };

  const siguienteSlide = () => {
    if (productosOferta.length > 0) {
      setSlideActive((prev) =>
        prev === productosOferta.length - 1 ? 0 : prev + 1,
      );
    }
  };
  const anteriorSlide = () => {
    if (productosOferta.length > 0) {
      setSlideActive((prev) =>
        prev === 0 ? productosOferta.length - 1 : prev - 1,
      );
    }
  };

  useEffect(() => {
    if (productosOferta.length > 0) {
      const intervalo = setInterval(() => {
        setSlideActive((prev) =>
          prev === productosOferta.length - 1 ? 0 : prev + 1,
        );
      }, 4000);
      return () => clearInterval(intervalo);
    }
  }, [productosOferta.length]);

  // VISTAS
  if (cargandoProductos) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.bg,
          fontSize: "20px",
          color: theme.primary,
          fontWeight: "bold",
        }}
      >
        Cargando catálogo...
      </div>
    );
  }

  // =========================================
  // VISTA 2: CHECKOUT
  // =========================================
  if (enCheckout) {
    return (
      <div
        style={{
          backgroundColor: theme.bg,
          minHeight: "100vh",
          fontFamily: "'Segoe UI', sans-serif",
          color: theme.text,
        }}
      >
        <header
          style={{
            backgroundColor: theme.white,
            borderBottom: `1px solid ${theme.border}`,
            padding: "20px 40px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "8px",
                background: theme.blue,
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                fontWeight: "bold",
              }}
            >
              ⚡
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: "20px",
                fontWeight: "800",
                color: theme.text,
              }}
            >
              {configTienda.nombreTienda}
            </h2>
          </div>
          <button
            onClick={() => setEnCheckout(false)}
            style={{
              background: "none",
              border: "none",
              color: theme.blue,
              fontWeight: "600",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            ← Volver a la tienda
          </button>
        </header>

        <div
          style={{
            maxWidth: "1000px",
            margin: "40px auto",
            display: "grid",
            gridTemplateColumns: "3fr 2fr",
            gap: "40px",
            padding: "0 20px",
          }}
        >
          <div>
            <h3
              style={{
                fontSize: "18px",
                marginBottom: "15px",
                color: theme.text,
              }}
            >
              Contacto
            </h3>
            <p
              style={{
                margin: "0 0 5px 0",
                fontSize: "13px",
                color: theme.textMuted,
              }}
            >
              Correo electrónico (Opcional)
            </p>
            <input
              type="email"
              placeholder="Ej. correo@ejemplo.com"
              style={{
                backgroundColor: "white",
                color: theme.text,
                width: "100%",
                padding: "12px",
                borderRadius: "6px",
                border: `1px solid ${theme.border}`,
                marginBottom: "25px",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />

            <h3
              style={{
                fontSize: "18px",
                marginBottom: "15px",
                color: theme.text,
              }}
            >
              Entrega{" "}
              <span
                style={{
                  fontSize: "12px",
                  color: theme.textMuted,
                  fontWeight: "normal",
                }}
              >
                (<span style={{ color: "red" }}>*</span> Obligatorios)
              </span>
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "15px",
                marginBottom: "15px",
              }}
            >
              <div>
                <p
                  style={{
                    margin: "0 0 5px 0",
                    fontSize: "13px",
                    color: theme.text,
                    fontWeight: "600",
                  }}
                >
                  Nombre <span style={{ color: "red" }}>*</span>
                </p>
                <input
                  type="text"
                  placeholder="Tu nombre"
                  value={nombreCliente}
                  onChange={(e) => setNombreCliente(e.target.value)}
                  style={{
                    backgroundColor: "white",
                    color: theme.text,
                    width: "100%",
                    padding: "12px",
                    borderRadius: "6px",
                    border: `1px solid ${theme.border}`,
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <p
                  style={{
                    margin: "0 0 5px 0",
                    fontSize: "13px",
                    color: theme.text,
                    fontWeight: "600",
                  }}
                >
                  Apellidos <span style={{ color: "red" }}>*</span>
                </p>
                <input
                  type="text"
                  placeholder="Tus apellidos"
                  value={apellidoCliente}
                  onChange={(e) => setApellidoCliente(e.target.value)}
                  style={{
                    backgroundColor: "white",
                    color: theme.text,
                    width: "100%",
                    padding: "12px",
                    borderRadius: "6px",
                    border: `1px solid ${theme.border}`,
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <p
                style={{
                  margin: "0 0 5px 0",
                  fontSize: "13px",
                  color: theme.text,
                  fontWeight: "600",
                }}
              >
                Número de WhatsApp <span style={{ color: "red" }}>*</span>
              </p>
              <input
                type="tel"
                placeholder="A 10 dígitos"
                value={telefonoCliente}
                onChange={(e) => setTelefonoCliente(e.target.value)}
                style={{
                  backgroundColor: "white",
                  color: theme.text,
                  width: "100%",
                  padding: "12px",
                  borderRadius: "6px",
                  border: `1px solid ${theme.border}`,
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <button
              onClick={procesarCompra}
              disabled={
                procesando ||
                carrito.length === 0 ||
                !nombreCliente.trim() ||
                !apellidoCliente.trim() ||
                !telefonoCliente.trim()
              }
              style={{
                width: "100%",
                padding: "16px",
                backgroundColor: theme.green,
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor:
                  procesando ||
                  !nombreCliente.trim() ||
                  !apellidoCliente.trim() ||
                  !telefonoCliente.trim()
                    ? "not-allowed"
                    : "pointer",
                marginTop: "10px",
                opacity:
                  procesando ||
                  !nombreCliente.trim() ||
                  !apellidoCliente.trim() ||
                  !telefonoCliente.trim()
                    ? 0.6
                    : 1,
              }}
            >
              {procesando ? "Procesando pedido..." : "Completar pedido"}
            </button>
          </div>

          <div
            style={{
              backgroundColor: theme.white,
              padding: "25px",
              borderRadius: "12px",
              border: `1px solid ${theme.border}`,
              height: "fit-content",
              position: "sticky",
              top: "20px",
            }}
          >
            {carrito.map((item) => (
              <div
                key={item._id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "15px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "15px" }}
                >
                  <div
                    style={{
                      width: "50px",
                      height: "50px",
                      backgroundColor: "#f3f4f6",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                    }}
                  >
                    📸
                    <span
                      style={{
                        position: "absolute",
                        top: "-5px",
                        right: "-5px",
                        backgroundColor: theme.textMuted,
                        color: "white",
                        fontSize: "10px",
                        width: "18px",
                        height: "18px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "50%",
                      }}
                    >
                      {item.cantidadSeleccionada}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: theme.text,
                    }}
                  >
                    {item.nombre}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: theme.text,
                  }}
                >
                  ${(item.precioVenta * item.cantidadSeleccionada).toFixed(2)}
                </span>
              </div>
            ))}

            <div
              style={{
                borderTop: `1px solid ${theme.border}`,
                margin: "20px 0",
                paddingTop: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "10px",
                  fontSize: "14px",
                  color: theme.textMuted,
                }}
              >
                <span>Subtotal</span>
                <span>${subtotalCarrito.toFixed(2)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "18px",
                  fontWeight: "800",
                  color: theme.text,
                }}
              >
                <span>Total</span>
                <span style={{ color: theme.green }}>
                  ${subtotalCarrito.toFixed(2)}{" "}
                  <span
                    style={{
                      fontSize: "12px",
                      color: theme.textMuted,
                      fontWeight: "normal",
                    }}
                  >
                    MXN
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================
  // VISTA 3: POLÍTICAS LEGALES
  // =========================================
  if (vistaLegal) {
    return (
      <div
        style={{
          backgroundColor: theme.bg,
          minHeight: "100vh",
          fontFamily: "'Segoe UI', sans-serif",
          color: theme.text,
        }}
      >
        <header
          style={{
            backgroundColor: theme.white,
            borderBottom: `1px solid ${theme.border}`,
            padding: "20px 40px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "8px",
                background: theme.blue,
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                fontWeight: "bold",
              }}
            >
              ⚡
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: "20px",
                fontWeight: "800",
                color: theme.text,
              }}
            >
              {configTienda.nombreTienda}
            </h2>
          </div>
        </header>

        <div
          style={{
            maxWidth: "800px",
            margin: "40px auto",
            padding: "40px",
            backgroundColor: theme.white,
            borderRadius: "12px",
            border: `1px solid ${theme.border}`,
          }}
        >
          <h1
            style={{
              textAlign: "center",
              marginBottom: "40px",
              color: theme.text,
            }}
          >
            Información Legal y Soporte
          </h1>
          <section style={{ marginBottom: "40px" }}>
            <h2
              style={{
                borderBottom: "2px solid #eee",
                paddingBottom: "10px",
                color: theme.text,
              }}
            >
              Política de Reembolso y Devoluciones
            </h2>
            <p
              style={{
                lineHeight: "1.6",
                color: theme.textMuted,
                whiteSpace: "pre-wrap",
              }}
            >
              {configTienda.politicaReembolso ||
                "El administrador de la tienda aún no ha establecido una política de reembolsos."}
            </p>
          </section>
          <section>
            <h2
              style={{
                borderBottom: "2px solid #eee",
                paddingBottom: "10px",
                color: theme.text,
              }}
            >
              Términos de Servicio
            </h2>
            <p
              style={{
                lineHeight: "1.6",
                color: theme.textMuted,
                whiteSpace: "pre-wrap",
              }}
            >
              {configTienda.terminosServicio ||
                "El administrador de la tienda aún no ha establecido los términos de servicio."}
            </p>
          </section>
        </div>
      </div>
    );
  }

  // =========================================
  // VISTA 1: TIENDA PRINCIPAL
  // =========================================
  return (
    <div
      style={{
        backgroundColor: theme.bg,
        minHeight: "100vh",
        fontFamily: "'Segoe UI', sans-serif",
        color: theme.text,
        overflowX: "hidden",
        width: "100%",
      }}
    >
      <header
        style={{
          backgroundColor: theme.white,
          borderBottom: `1px solid ${theme.border}`,
          padding: "clamp(10px, 3vw, 15px) clamp(15px, 5vw, 40px)",
          display: "flex",
          flexWrap: "wrap",
          gap: "15px",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 50,
          boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
          boxSizing: "border-box",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              backgroundColor: theme.blue,
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              fontWeight: "bold",
            }}
          >
            ⚡
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: "22px",
              fontWeight: "800",
              letterSpacing: "-0.5px",
              color: theme.text,
            }}
          >
            {configTienda.nombreTienda}
          </h2>
        </div>

        <nav
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "clamp(10px, 2vw, 25px)",
            fontWeight: "600",
            fontSize: "13px",
            color: theme.textMuted,
            flex: "1 1 auto",
          }}
        >
          {/* Botón estático para ver todo el catálogo */}
          <span
            onClick={() => setCategoriaActiva("TODAS")}
            style={{
              color:
                categoriaActiva === "TODAS" ? theme.primary : theme.textMuted,
              cursor: "pointer",
              borderBottom:
                categoriaActiva === "TODAS"
                  ? `2px solid ${theme.primary}`
                  : "none",
            }}
          >
            TODO EL CATÁLOGO
          </span>

          {/* Botones dinámicos generados desde la base de datos */}
          {categorias.map((cat) => (
            <span
              key={cat._id}
              onClick={() => setCategoriaActiva(cat._id)}
              style={{
                color:
                  categoriaActiva === cat._id ? theme.primary : theme.textMuted,
                cursor: "pointer",
                borderBottom:
                  categoriaActiva === cat._id
                    ? `2px solid ${theme.primary}`
                    : "none",
                textTransform: "uppercase",
              }}
            >
              {cat.nombre}
            </span>
          ))}
        </nav>

        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          {/* BARRA DE BÚSQUEDA DESPLEGABLE */}
          <div
            id="contenedor-buscador"
            style={{ display: "flex", gap: "10px", alignItems: "center" }}
          >
            {mostrarBuscador && (
              <input
                type="text"
                placeholder="Buscar producto..."
                value={busquedaTienda}
                onChange={(e) => setBusquedaTienda(e.target.value)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  border: `1px solid ${theme.border}`,
                  outline: "none",
                  fontSize: "13px",
                  width: "150px",
                }}
                autoFocus
              />
            )}
            <span
              onClick={() => {
                setMostrarBuscador(!mostrarBuscador);
                if (mostrarBuscador) setBusquedaTienda(""); // Limpia al cerrar
              }}
              style={{ cursor: "pointer", fontSize: "18px" }}
            >
              🔍
            </span>
          </div>

          {/* ICONO DE USUARIO CON AVISO */}
          <span
            onClick={() =>
              alert(
                "🛠️ El sistema de cuentas para clientes y registro de historial estará disponible en futuras actualizaciones. ¡Gracias por tu paciencia!",
              )
            }
            style={{ cursor: "pointer", fontSize: "18px" }}
            title="Mi Cuenta"
          >
            👤
          </span>

          <button
            onClick={() => setCarritoAbierto(true)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              position: "relative",
              display: "flex",
              alignItems: "center",
              padding: 0,
            }}
          >
            <span style={{ fontSize: "22px" }}>🛍️</span>
            <span
              style={{
                position: "absolute",
                top: "-5px",
                right: "-8px",
                backgroundColor: theme.primary,
                color: "white",
                fontSize: "11px",
                fontWeight: "bold",
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {totalArticulos}
            </span>
          </button>
        </div>
      </header>

      {categoriaActiva === "TODAS" && busquedaTienda === "" && (
        <section
          style={{
            padding: "clamp(15px, 3vw, 30px) clamp(15px, 4vw, 40px)",
            boxSizing: "border-box",
            width: "100%",
            maxWidth: "100vw",
          }}
        >
          <div
            style={{
              backgroundColor: theme.white,
              border: `1px solid ${theme.border}`,
              borderRadius: "16px",
              padding: "clamp(15px, 4vw, 40px)",
              display: "flex",
              flexWrap: "wrap",
              gap: "clamp(20px, 4vw, 40px)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
              overflow: "hidden",
              boxSizing: "border-box",
              width: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                textAlign: "left",
                flex: "1 1 280px",
                minWidth: 0,
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  backgroundColor: "#f3f0ff",
                  color: theme.primary,
                  padding: "6px 16px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginBottom: "15px",
                  width: "fit-content",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                }}
              >
                ¡Especial de Verano!
              </div>
              <h1
                style={{
                  color: theme.text,
                  fontSize: "clamp(32px, 5vw, 44px)",
                  margin: "0 0 10px 0",
                  fontWeight: "900",
                  lineHeight: "1.1",
                }}
              >
                {configTienda.mensajeBanner}
              </h1>
              <p
                style={{
                  color: theme.textMuted,
                  fontSize: "15px",
                  maxWidth: "450px",
                  margin: "10px 0 25px 0",
                  lineHeight: "1.5",
                }}
              >
                {configTienda.descripcionBanner}
              </p>
              <div>
                <button
                  style={{
                    backgroundColor: theme.primary,
                    color: "white",
                    border: "none",
                    padding: "14px 32px",
                    borderRadius: "8px",
                    fontSize: "15px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(124, 58, 237, 0.2)",
                  }}
                >
                  Ver Promociones
                </button>
              </div>
            </div>

            <div
              style={{
                backgroundColor: theme.bg,
                borderRadius: "12px",
                padding: "clamp(15px, 4vw, 25px)",
                border: `1px solid ${theme.border}`,
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                alignItems: "center",
                minHeight: "350px",
                flex: "1 1 280px",
                minWidth: 0,
                maxWidth: "100%",
                boxSizing: "border-box",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "15px",
                  left: "15px",
                  backgroundColor: theme.red,
                  color: "white",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: "bold",
                  zIndex: 2,
                }}
              >
                OFERTA TOP
              </span>
              <button
                onClick={anteriorSlide}
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.white,
                  color: theme.text,
                  cursor: "pointer",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 10,
                  boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
                }}
              >
                ←
              </button>

              <div
                style={{
                  width: "100%",
                  flex: 1,
                  overflow: "hidden",
                  position: "relative",
                  display: "flex",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: "100%",
                    transition: "transform 0.5s ease-in-out",
                    transform: `translateX(-${slideActual * 100}%)`,
                    alignItems: "center",
                  }}
                >
                  {productosOferta.map((producto) => (
                    <div
                      key={producto._id}
                      style={{
                        flex: "0 0 100%",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        textAlign: "center",
                        padding: "0 clamp(20px, 8vw, 40px)",
                        boxSizing: "border-box",
                      }}
                    >
                      <div
                        style={{
                          width: "140px",
                          height: "140px",
                          backgroundColor: "#f1f3f5",
                          borderRadius: "12px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "60px",
                          marginBottom: "15px",
                          overflow: "hidden", // <-- Importante para que la foto respete el borde redondo
                        }}
                      >
                        {producto.fotos && producto.fotos.length > 0 ? (
                          <img
                            src={producto.fotos[0]}
                            alt={producto.nombre}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          "📸"
                        )}
                      </div>
                      <h3
                        style={{
                          margin: "0 0 5px 0",
                          fontSize: "16px",
                          color: theme.text,
                          fontWeight: "700",
                        }}
                      >
                        {producto.nombre}
                      </h3>
                      <p
                        style={{
                          margin: "0 0 10px 0",
                          fontSize: "13px",
                          color: theme.textMuted,
                        }}
                      >
                        {producto.descripcion}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          justifyContent: "center",
                          marginBottom: "10px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "14px",
                            color: theme.textMuted,
                            textDecoration: "line-through",
                            fontWeight: "500",
                          }}
                        >
                          ${producto.precioOriginal.toFixed(2)}
                        </span>
                        <span
                          style={{
                            fontSize: "22px",
                            color: theme.green,
                            fontWeight: "900",
                          }}
                        >
                          ${producto.precioVenta.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={siguienteSlide}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.white,
                  color: theme.text,
                  cursor: "pointer",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 10,
                  boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
                }}
              >
                →
              </button>
              {productosOferta.length > 0 && (
                <button
                  onClick={() => agregarAlCarrito(productosOferta[slideActual])}
                  style={{
                    width: "100%",
                    padding: "12px",
                    backgroundColor: theme.blue,
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    transition: "background-color 0.2s",
                    marginTop: "auto",
                    zIndex: 2,
                    boxSizing: "border-box",
                  }}
                >
                  Añadir al carrito
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      <section style={{ padding: "0 40px 60px 40px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "25px",
          }}
        >
          <h2
            style={{
              fontSize: "24px",
              margin: 0,
              fontWeight: "800",
              color: theme.text,
            }}
          >
            Catálogo de Productos
          </h2>
        </div>

        {/* AQUÍ ESTÁ LA CORRECCIÓN: Un solo validador usando la variable filtrada */}
        {productosAMostrar.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px",
              color: theme.textMuted,
            }}
          >
            No hay productos disponibles en esta categoría.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "24px",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            }}
          >
            {productosAMostrar.map((producto) => (
              <TarjetaProducto
                key={producto._id}
                producto={producto}
                theme={theme}
                agregarAlCarrito={agregarAlCarrito}
              />
            ))}
          </div>
        )}
      </section>

      <section
        style={{
          backgroundColor: theme.white,
          padding: "60px 40px",
          borderTop: `1px solid ${theme.border}`,
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "40px",
          }}
        >
          <BadgeConfianza
            icono="📦"
            titulo="Envíos a todo México"
            descripcion="Recíbelo en la puerta de tu casa de forma rápida."
            theme={theme}
          />
          <BadgeConfianza
            icono="🛡️"
            titulo="Garantía de Calidad"
            descripcion="Productos probados y garantizados contra defectos."
            theme={theme}
          />
          <BadgeConfianza
            icono="🔒"
            titulo="Compra Segura"
            descripcion="Tu información y tus pagos están 100% protegidos."
            theme={theme}
          />
          <BadgeConfianza
            icono="⭐"
            titulo="Clientes Satisfechos"
            descripcion="Más de 500 reseñas positivas respaldan nuestro servicio."
            theme={theme}
          />
        </div>
      </section>

      <section
        style={{
          padding: "80px 40px",
          backgroundColor: theme.bg,
          maxWidth: "800px",
          margin: "0 auto",
        }}
      >
        <h2
          style={{
            textAlign: "center",
            fontSize: "32px",
            fontWeight: "800",
            marginBottom: "40px",
            color: theme.text,
          }}
        >
          Preguntas Frecuentes
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <FaqItem
            pregunta="¿Cuánto tarda en llegar mi pedido?"
            respuesta="El tiempo de entrega estándar es de 3 a 5 días hábiles a todo México tras procesar tu pago."
            theme={theme}
          />
          <FaqItem
            pregunta="¿Qué formas de pago aceptan?"
            respuesta="Aceptamos tarjetas de crédito/débito, PayPal y pagos en efectivo a través de tiendas de conveniencia."
            theme={theme}
          />
          <FaqItem
            pregunta="¿Puedo devolver un producto si llega dañado?"
            respuesta="Sí, tienes 7 días naturales desde que recibes el paquete para reportar cualquier daño y solicitar un reemplazo sin costo extra."
            theme={theme}
          />
          <FaqItem
            pregunta="¿Cómo aplico mi código de descuento?"
            respuesta="En la pantalla de pago (Checkout) encontrarás una casilla para ingresar tu cupón antes de finalizar la compra."
            theme={theme}
          />
        </div>
      </section>

      <footer
        style={{
          backgroundColor: theme.footerBg,
          color: theme.textMuted,
          padding: "60px 40px 30px 40px",
          borderTop: `1px solid ${theme.border}`,
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "40px",
            paddingBottom: "40px",
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "20px",
              }}
            >
              <span style={{ fontSize: "24px" }}>⚡</span>
              <span
                style={{
                  color: theme.text,
                  fontSize: "20px",
                  fontWeight: "bold",
                }}
              >
                TechStore
              </span>
            </div>
            <p style={{ fontSize: "13px", lineHeight: "1.6" }}>
              Conectando tu vida con la mejor tecnología. Accesorios, fundas y
              cables de alta duración.
            </p>
          </div>

          {/* Columna de Contacto Modificada */}
          <div>
            <h4
              style={{
                color: theme.text,
                marginBottom: "20px",
                fontSize: "15px",
              }}
            >
              Contacto de la Tienda
            </h4>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                fontSize: "13px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {configTienda.whatsappTienda && (
                <li>
                  <span style={{ fontWeight: "bold", color: theme.text }}>
                    WhatsApp:{" "}
                  </span>
                  <span style={{ color: theme.textMuted }}>
                    {configTienda.whatsappTienda}
                  </span>
                </li>
              )}
              {configTienda.correoTienda && (
                <li>
                  <span style={{ fontWeight: "bold", color: theme.text }}>
                    Correo:{" "}
                  </span>
                  <a
                    href={`mailto:${configTienda.correoTienda}`}
                    style={{ color: theme.textMuted, textDecoration: "none" }}
                  >
                    {configTienda.correoTienda}
                  </a>
                </li>
              )}
              {!configTienda.whatsappTienda && !configTienda.correoTienda && (
                <li style={{ color: theme.textMuted }}>
                  Contacto no disponible
                </li>
              )}
            </ul>

            <h4
              style={{
                color: theme.text,
                marginTop: "30px",
                marginBottom: "15px",
                fontSize: "13px",
              }}
            >
              Soporte de la Plataforma
            </h4>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                fontSize: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "5px",
              }}
            >
              <li style={{ fontWeight: "bold", color: theme.text }}>
                Hendrick Pérez Mena
              </li>
              <li>
                <a
                  href="mailto:hendrick9976@gmail.com"
                  style={{
                    cursor: "pointer",
                    color: theme.textMuted,
                    textDecoration: "none",
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.target.style.color = theme.primary)}
                  onMouseLeave={(e) => (e.target.style.color = theme.textMuted)}
                >
                  hendrick9976@gmail.com
                </a>
              </li>
            </ul>
          </div>

          {/* Columna Legal conectada al historial del navegador */}
          <div>
            <h4
              style={{
                color: theme.text,
                marginBottom: "20px",
                fontSize: "15px",
              }}
            >
              Soporte Legal
            </h4>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                fontSize: "13px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <li>
                <span
                  onClick={abrirVistaLegal}
                  style={{
                    cursor: "pointer",
                    color: theme.textMuted,
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.target.style.color = theme.primary)}
                  onMouseLeave={(e) => (e.target.style.color = theme.textMuted)}
                >
                  Términos del Servicio
                </span>
              </li>
              <li>
                <span
                  onClick={abrirVistaLegal}
                  style={{
                    cursor: "pointer",
                    color: theme.textMuted,
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.target.style.color = theme.primary)}
                  onMouseLeave={(e) => (e.target.style.color = theme.textMuted)}
                >
                  Política de Privacidad
                </span>
              </li>
              <li>
                <span
                  onClick={abrirVistaLegal}
                  style={{
                    cursor: "pointer",
                    color: theme.textMuted,
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.target.style.color = theme.primary)}
                  onMouseLeave={(e) => (e.target.style.color = theme.textMuted)}
                >
                  Política de Reembolso
                </span>
              </li>
            </ul>
          </div>

          <div>
            <h4
              style={{
                color: theme.text,
                marginBottom: "10px",
                fontSize: "15px",
              }}
            >
              Mantente informado
            </h4>
            <p
              style={{
                fontSize: "12px",
                color: theme.textMuted,
                marginBottom: "15px",
                lineHeight: "1.4",
              }}
            >
              Entérate de próximas actualizaciones o próximas ofertas.
            </p>
            <div style={{ display: "flex", gap: "5px" }}>
              <input
                type="email"
                placeholder="Tu correo electrónico"
                style={{
                  padding: "10px",
                  borderRadius: "6px",
                  border: `1px solid ${theme.border}`,
                  backgroundColor: "white",
                  color: theme.text,
                  width: "100%",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              />
              <button
                style={{
                  padding: "10px 15px",
                  backgroundColor: theme.primary,
                  border: "none",
                  borderRadius: "6px",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                →
              </button>
            </div>
          </div>
        </div>
        <div
          style={{
            maxWidth: "1200px",
            margin: "30px auto 0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "20px",
            fontSize: "12px",
          }}
        >
          <div>
            © 2026 {configTienda.nombreTienda}. Todos los derechos reservados. |
            Sistema administrado por{" "}
            <span
              onClick={() => (window.location.href = "http://localhost:5173")}
              style={{
                color: theme.primary,
                cursor: "pointer",
                fontWeight: "bold",
                textDecoration: "underline",
              }}
            >
              Inventario Inteligente
            </span>
          </div>
        </div>
      </footer>

      {/* =========================================
          OVERLAY Y CARRITO LATERAL (DRAWER)
          ========================================= */}
      {carritoAbierto && (
        <>
          <div
            onClick={() => setCarritoAbierto(false)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              backgroundColor: "rgba(0,0,0,0.4)",
              zIndex: 999,
              cursor: "pointer",
            }}
          />
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              width: "450px",
              maxWidth: "100vw",
              height: "100vh",
              backgroundColor: theme.white,
              zIndex: 1000,
              boxShadow: "-5px 0 25px rgba(0,0,0,0.1)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "20px",
                borderBottom: `1px solid ${theme.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "20px", color: theme.text }}>
                Tu Carrito ({totalArticulos})
              </h2>
              <button
                onClick={() => setCarritoAbierto(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                  color: theme.textMuted,
                }}
              >
                ✖
              </button>
            </div>

            <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
              {carrito.length === 0 ? (
                <p
                  style={{
                    textAlign: "center",
                    color: theme.textMuted,
                    marginTop: "50px",
                  }}
                >
                  Tu carrito está vacío.
                </p>
              ) : (
                carrito.map((item) => (
                  <div
                    key={item._id}
                    style={{
                      display: "flex",
                      gap: "15px",
                      marginBottom: "20px",
                      paddingBottom: "20px",
                      borderBottom: `1px solid ${theme.border}`,
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        width: "80px",
                        height: "80px",
                        backgroundColor: "#f1f3f5",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "30px",
                      }}
                    >
                      📸
                    </div>
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <h4
                          style={{
                            margin: "0 0 5px 0",
                            fontSize: "15px",
                            color: theme.text,
                            fontWeight: "700",
                          }}
                        >
                          {item.nombre}
                        </h4>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          {item.precioOferta > 0 && (
                            <span
                              style={{
                                fontSize: "12px",
                                color: theme.textMuted,
                                textDecoration: "line-through",
                              }}
                            >
                              ${item.precioOriginal.toFixed(2)}
                            </span>
                          )}
                          <p
                            style={{
                              margin: 0,
                              fontSize: "15px",
                              fontWeight: "800",
                              color: theme.green,
                            }}
                          >
                            ${item.precioVenta.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: "10px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            border: `1px solid ${theme.border}`,
                            borderRadius: "6px",
                            overflow: "hidden",
                            backgroundColor: theme.white,
                          }}
                        >
                          <button
                            onClick={() => modificarCantidad(item._id, -1)}
                            style={{
                              padding: "6px 12px",
                              border: "none",
                              cursor: "pointer",
                              backgroundColor: "#f8f9fa",
                              color: theme.text,
                              fontSize: "14px",
                              fontWeight: "bold",
                            }}
                          >
                            -
                          </button>
                          <span
                            style={{
                              padding: "6px 12px",
                              fontSize: "13px",
                              borderLeft: `1px solid ${theme.border}`,
                              borderRight: `1px solid ${theme.border}`,
                              display: "flex",
                              alignItems: "center",
                              color: theme.text,
                            }}
                          >
                            {item.cantidadSeleccionada}
                          </span>
                          <button
                            onClick={() => modificarCantidad(item._id, 1)}
                            style={{
                              padding: "6px 12px",
                              border: "none",
                              cursor: "pointer",
                              backgroundColor: "#f8f9fa",
                              color: theme.text,
                              fontSize: "14px",
                              fontWeight: "bold",
                            }}
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => eliminarDelCarrito(item._id)}
                          style={{
                            backgroundColor: theme.red,
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            padding: "6px 12px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "600",
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div
              style={{
                padding: "20px",
                borderTop: `1px solid ${theme.border}`,
                backgroundColor: "#f8f9fa",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "20px",
                  fontSize: "18px",
                  fontWeight: "bold",
                  color: theme.text,
                }}
              >
                <span>Subtotal</span>
                <span>${subtotalCarrito.toFixed(2)}</span>
              </div>
              <button
                onClick={() => setCarritoAbierto(false)}
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: theme.white,
                  color: theme.blue,
                  border: `2px solid ${theme.blue}`,
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  marginBottom: "10px",
                }}
              >
                + Añadir más productos
              </button>
              <button
                onClick={() => {
                  setCarritoAbierto(false);
                  setEnCheckout(true);
                }}
                disabled={carrito.length === 0}
                style={{
                  width: "100%",
                  padding: "16px",
                  backgroundColor: theme.green,
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: carrito.length === 0 ? "not-allowed" : "pointer",
                  opacity: carrito.length === 0 ? 0.5 : 1,
                }}
              >
                FINALIZAR PEDIDO
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BadgeConfianza({ icono, titulo, descripcion, theme }) {
  return (
    <div style={{ textAlign: "center", padding: "10px" }}>
      <div style={{ fontSize: "32px", marginBottom: "15px" }}>{icono}</div>
      <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", color: theme.text }}>
        {titulo}
      </h3>
      <p
        style={{
          margin: 0,
          fontSize: "13px",
          color: theme.textMuted,
          lineHeight: "1.5",
        }}
      >
        {descripcion}
      </p>
    </div>
  );
}

function FaqItem({ pregunta, respuesta, theme }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div
      style={{
        backgroundColor: theme.white,
        borderRadius: "8px",
        border: `1px solid ${theme.border}`,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setAbierto(!abierto)}
        style={{
          width: "100%",
          padding: "20px",
          backgroundColor: "transparent",
          border: "none",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          fontSize: "15px",
          fontWeight: "bold",
          color: theme.text,
          textAlign: "left",
        }}
      >
        <span>❔ {pregunta}</span>
        <span style={{ color: theme.textMuted }}>{abierto ? "▲" : "▼"}</span>
      </button>
      {abierto && (
        <div
          style={{
            padding: "0 20px 20px 20px",
            fontSize: "14px",
            color: theme.textMuted,
            lineHeight: "1.6",
          }}
        >
          {respuesta}
        </div>
      )}
    </div>
  );
}

function TarjetaProducto({ producto, theme, agregarAlCarrito }) {
  const sinStock = producto.stock === 0;
  const pocoStock = producto.stock > 0 && producto.stock <= 5;
  const tieneDescuento = producto.precioOferta > 0;

  return (
    <div
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.03)";
      }}
      style={{
        backgroundColor: theme.white,
        border: `1px solid ${theme.border}`,
        borderRadius: "14px",
        overflow: "hidden",
        boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
        display: "flex",
        flexDirection: "column",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        textAlign: "left",
      }}
    >
      <div
        style={{
          height: "200px",
          backgroundColor: "#f1f3f5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Lógica para renderizar la foto de Cloudinary si existe */}
        {producto.fotos && producto.fotos.length > 0 ? (
          <img
            src={producto.fotos[0]}
            alt={producto.nombre}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ fontSize: "40px", color: "#dee2e6" }}>📸</span>
        )}

        {/* Tus badges originales de inventario */}
        {sinStock ? (
          <span
            style={{
              position: "absolute",
              top: "10px",
              left: "10px",
              backgroundColor: "#fde8e8",
              color: "#9b1c1c",
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "bold",
              border: "1px solid #f8b4b4",
            }}
          >
            Agotado
          </span>
        ) : pocoStock ? (
          <span
            style={{
              position: "absolute",
              top: "10px",
              left: "10px",
              backgroundColor: "#fef3c7",
              color: "#92400e",
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "bold",
              border: "1px solid #fde68a",
            }}
          >
            ¡Solo quedan {producto.stock}!
          </span>
        ) : null}
      </div>
      <div
        style={{
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          flex: 1,
        }}
      >
        <h3
          style={{ margin: "0 0 6px 0", fontSize: "16px", color: theme.text }}
        >
          {producto.nombre}
        </h3>
        <p
          style={{
            margin: "0 0 16px 0",
            fontSize: "13px",
            color: theme.textMuted,
            flex: 1,
          }}
        >
          {producto.descripcion}
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {tieneDescuento && (
              <span
                style={{
                  fontSize: "14px",
                  color: theme.textMuted,
                  textDecoration: "line-through",
                  fontWeight: "500",
                }}
              >
                ${producto.precioOriginal.toFixed(2)}
              </span>
            )}
            <span
              style={{
                fontSize: "20px",
                fontWeight: "800",
                color: theme.green,
              }}
            >
              ${producto.precioVenta.toFixed(2)}
            </span>
          </div>
        </div>
        <button
          onClick={() => agregarAlCarrito(producto)}
          disabled={sinStock}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: sinStock ? "#e9ecef" : theme.blue,
            color: sinStock ? "#adb5bd" : "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: "bold",
            cursor: sinStock ? "not-allowed" : "pointer",
            transition: "background-color 0.2s",
          }}
        >
          {sinStock ? "Sin inventario" : "Añadir al carrito"}
        </button>
      </div>
    </div>
  );
}

export default App;
