import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAudioPlayer } from "expo-audio";

const STORAGE_KEY = "mathapp_historial";

const sonidoCorrecto = require("./assets/sounds/correct.wav");
const sonidoIncorrecto = require("./assets/sounds/wrong.wav");
const sonidoTimeout = require("./assets/sounds/timeout.wav");
const sonidoFinal = require("./assets/sounds/finish.wav");
const musicaFondo = require("./assets/sounds/background.wav");

/* ============================================================
   CONFIGURACIÓN DE DIFICULTAD
   - Tiempo máximo por operación segun dificultad.
   ============================================================ */
const dificultades = {
  facil: {
    nombre: "Fácil",
    min: 1,
    max: 10,
    operadores: ["+", "-"],
    tiempo: 12,
    tiempoTotalContraReloj: 60,
  },
  medio: {
    nombre: "Medio",
    min: 5,
    max: 30,
    operadores: ["+", "-", "*"],
    tiempo: 10,
    tiempoTotalContraReloj: 45,
  },
  dificil: {
    nombre: "Difícil",
    min: 10,
    max: 80,
    operadores: ["+", "-", "*"],
    tiempo: 8,
    tiempoTotalContraReloj: 30,
  },
};

const modosJuego = {
  clasico: "Clásico",
  verdaderoFalso: "Verdadero / Falso",
  multipleChoice: "Multiple choice",
  contraReloj: "Contra reloj",
};

function numeroAleatorio(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calcularResultado(a, b, op) {
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "*") return a * b;
  return 0;
}

function generarOperacion(dif) {
  const config = dificultades[dif];
  const operador =
    config.operadores[numeroAleatorio(0, config.operadores.length - 1)];

  let numero1 = numeroAleatorio(config.min, config.max);
  let numero2 = numeroAleatorio(config.min, config.max);

  if (operador === "-" && numero2 > numero1) {
    const aux = numero1;
    numero1 = numero2;
    numero2 = aux;
  }

  const resultado = calcularResultado(numero1, numero2, operador);
  return { texto: `${numero1} ${operador} ${numero2}`, resultado };
}

function mezclar(array) {
  return array.sort(() => Math.random() - 0.5);
}

function generarOpcionesMC(correcto) {
  const opciones = new Set();
  opciones.add(correcto);
  while (opciones.size < 4) {
    let variacion = numeroAleatorio(-10, 10);
    if (variacion === 0) variacion = 1;
    const opcion = correcto + variacion;
    if (opcion >= 0) opciones.add(opcion);
  }
  return mezclar(Array.from(opciones));
}

function generarPregunta(dif, modo) {
  const op = generarOperacion(dif);

  if (modo === "verdaderoFalso") {
    const esVerdadera = Math.random() > 0.5;
    let resultadoMostrado = op.resultado;
    if (!esVerdadera) {
      resultadoMostrado = op.resultado + numeroAleatorio(-5, 5);
      if (resultadoMostrado === op.resultado) resultadoMostrado += 1;
      if (resultadoMostrado < 0) resultadoMostrado = op.resultado + 1;
    }
    return {
      texto: `${op.texto} = ${resultadoMostrado}`,
      resultado: op.resultado,
      esVerdadera,
      opciones: [],
    };
  }

  if (modo === "multipleChoice") {
    return {
      texto: op.texto,
      resultado: op.resultado,
      opciones: generarOpcionesMC(op.resultado),
    };
  }

  return { texto: op.texto, resultado: op.resultado, opciones: [] };
}

function calcularPromedio(tiempos) {
  if (tiempos.length === 0) return 0;
  return tiempos.reduce((t, x) => t + x, 0) / tiempos.length;
}

export default function App() {
  // pantallas: menu | juego | resultado
  const [pantalla, setPantalla] = useState("menu");

  const [dificultad, setDificultad] = useState("facil");
  const [modo, setModo] = useState("clasico");
  const [cantidadPreguntas, setCantidadPreguntas] = useState("10");

  const [preguntaActual, setPreguntaActual] = useState(null);
  const [numeroPregunta, setNumeroPregunta] = useState(0);
  const [respuestaUsuario, setRespuestaUsuario] = useState("");

  const [puntaje, setPuntaje] = useState(0);
  const [correctas, setCorrectas] = useState(0);
  const [incorrectas, setIncorrectas] = useState(0);
  const [sinResponder, setSinResponder] = useState(0);

  const [tiempoRestante, setTiempoRestante] = useState(0);
  const [inicioPregunta, setInicioPregunta] = useState(null);
  const [tiemposRespuesta, setTiemposRespuesta] = useState([]);

  const [historial, setHistorial] = useState([]);

  const [resultadoActual, setResultadoActual] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const [sonidoActivo, setSonidoActivo] = useState(true);
  const [musicaActiva, setMusicaActiva] = useState(false);

  const playerCorrecto = useAudioPlayer(sonidoCorrecto);
  const playerIncorrecto = useAudioPlayer(sonidoIncorrecto);
  const playerTimeout = useAudioPlayer(sonidoTimeout);
  const playerFinal = useAudioPlayer(sonidoFinal);
  const playerMusica = useAudioPlayer(musicaFondo);

  const procesandoRef = useRef(false);

  const fadeIn = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    cargarHistorial();
  }, []);

  useEffect(() => {
    try {
      playerCorrecto.volume = 0.9;
      playerIncorrecto.volume = 0.9;
      playerTimeout.volume = 0.9;
      playerFinal.volume = 0.9;
      playerMusica.volume = 0.18;
      playerMusica.loop = true;
    } catch (e) {
      console.log("Audio config:", e);
    }
  }, []);

  useEffect(() => {
    try {
      const debeSonar = pantalla === "juego" && musicaActiva && sonidoActivo;
      if (debeSonar) {
        playerMusica.seekTo(0);
        playerMusica.play();
      } else {
        playerMusica.pause();
        playerMusica.seekTo(0);
      }
    } catch (e) {
      console.log("Music:", e);
    }
  }, [pantalla, musicaActiva, sonidoActivo]);

  // fade suave al cambiar de pantalla
  useEffect(() => {
    fadeIn.setValue(0);
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [pantalla]);

  // timer por pregunta / total contra reloj
  useEffect(() => {
    if (pantalla !== "juego" || !preguntaActual) return;
    if (tiempoRestante <= 0) {
      manejarSinRespuesta();
      return;
    }
    const timer = setTimeout(() => {
      setTiempoRestante((v) => v - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [tiempoRestante, pantalla, preguntaActual]);

  function reproducir(player) {
    if (!sonidoActivo || !player) return;
    try {
      player.pause();
      player.seekTo(0);
      setTimeout(() => player.play(), 30);
    } catch (e) {
      console.log("Sound:", e);
    }
  }

  async function cargarHistorial() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) setHistorial(JSON.parse(data));
    } catch (e) {
      console.log("Load history:", e);
    }
  }

  async function guardarEnHistorial(res) {
    try {
      const actualizado = [res, ...historial].slice(0, 15);
      setHistorial(actualizado);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(actualizado));
    } catch (e) {
      console.log("Save history:", e);
    }
  }

  function borrarHistorial() {
    Alert.alert(
      "Borrar historial",
      "¿Borrar todas las partidas guardadas?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem(STORAGE_KEY);
            setHistorial([]);
          },
        },
      ]
    );
  }

  function mostrarInstrucciones() {
    Alert.alert(
      "Instrucciones",
      "Elegí dificultad y modo de juego.\n\n" +
        "Clásico: ingresás el resultado.\n" +
        "Verdadero/Falso: indicás si la igualdad es correcta.\n" +
        "Multiple choice: elegís una de 4 opciones.\n" +
        "Contra reloj: respondés hasta fallar o que termine el tiempo total.\n\n" +
        "Puntaje:\n" +
        "Correcta rápida (<75% del tiempo): +100\n" +
        "Correcta: +70\n" +
        "Incorrecta: -30\n" +
        "Sin respuesta: -50"
    );
  }

  function crearNuevaPregunta(numero, reiniciarTiempo = true) {
    const nueva = generarPregunta(dificultad, modo);
    procesandoRef.current = false;
    setFeedback(null);
    setPreguntaActual(nueva);
    setNumeroPregunta(numero);
    setRespuestaUsuario("");
    setInicioPregunta(Date.now());
    if (modo !== "contraReloj" && reiniciarTiempo) {
      setTiempoRestante(dificultades[dificultad].tiempo);
    }
  }

  function iniciarJuego() {
    const total = Number(cantidadPreguntas);
    if (modo !== "contraReloj" && (!total || total <= 0)) {
      Alert.alert("Atención", "Ingresá una cantidad válida de preguntas.");
      return;
    }

    setPuntaje(0);
    setCorrectas(0);
    setIncorrectas(0);
    setSinResponder(0);
    setTiemposRespuesta([]);
    setResultadoActual(null);
    setFeedback(null);
    setPantalla("juego");

    if (modo === "contraReloj") {
      setTiempoRestante(dificultades[dificultad].tiempoTotalContraReloj);
      crearNuevaPregunta(1, false);
    } else {
      crearNuevaPregunta(1, true);
    }
  }

  function calcularPuntaje(esCorrecta, tiempoRespuesta) {
    const tiempoMax = dificultades[dificultad].tiempo;
    if (!esCorrecta) return -30;
    return tiempoRespuesta <= tiempoMax * 0.75 ? 100 : 70;
  }

  async function finalizarJuego(d) {
    procesandoRef.current = true;
    const operaciones = d.correctas + d.incorrectas + d.sinResponder;
    const precision =
      operaciones > 0 ? Math.round((d.correctas / operaciones) * 100) : 0;
    const promedio = calcularPromedio(d.tiemposRespuesta);
    const tiempoPromedio = Number(promedio.toFixed(2));

    const resultado = {
      id: Date.now().toString(),
      fecha: new Date().toLocaleString(),
      dificultad: dificultades[dificultad].nombre,
      modo: modosJuego[modo],
      modoKey: modo,
      puntaje: d.puntaje,
      correctas: d.correctas,
      incorrectas: d.incorrectas,
      sinResponder: d.sinResponder,
      operaciones,
      tiempoPromedio,
      precision,
    };

    setResultadoActual(resultado);
    await guardarEnHistorial(resultado);
    reproducir(playerFinal);
    setPantalla("resultado");
  }

  function continuarLuego(d, debeFinalizar) {
    setTimeout(() => {
      if (debeFinalizar) finalizarJuego(d);
      else crearNuevaPregunta(numeroPregunta + 1, modo !== "contraReloj");
    }, 500);
  }

  function responder(respuesta = null) {
    if (procesandoRef.current) return;

    if (
      (modo === "clasico" || modo === "contraReloj") &&
      respuestaUsuario.trim() === ""
    ) {
      Alert.alert("Atención", "Ingresá una respuesta.");
      return;
    }

    procesandoRef.current = true;
    let esCorrecta = false;

    if (modo === "clasico" || modo === "contraReloj") {
      esCorrecta = Number(respuestaUsuario) === preguntaActual.resultado;
    }
    if (modo === "verdaderoFalso") {
      esCorrecta = respuesta === preguntaActual.esVerdadera;
    }
    if (modo === "multipleChoice") {
      esCorrecta = respuesta === preguntaActual.resultado;
    }

    const tiempoRespuesta = (Date.now() - inicioPregunta) / 1000;
    const puntos = calcularPuntaje(esCorrecta, tiempoRespuesta);

    const nuevoPuntaje = puntaje + puntos;
    const nuevasCorrectas = correctas + (esCorrecta ? 1 : 0);
    const nuevasIncorrectas = incorrectas + (!esCorrecta ? 1 : 0);
    const nuevosTiempos = [...tiemposRespuesta, tiempoRespuesta];

    setPuntaje(nuevoPuntaje);
    setCorrectas(nuevasCorrectas);
    setIncorrectas(nuevasIncorrectas);
    setTiemposRespuesta(nuevosTiempos);

    reproducir(esCorrecta ? playerCorrecto : playerIncorrecto);

    setFeedback({
      tipo: esCorrecta ? "correcto" : "incorrecto",
      texto: esCorrecta ? `Correcto +${puntos}` : "Incorrecto −30",
    });

    const d = {
      puntaje: nuevoPuntaje,
      correctas: nuevasCorrectas,
      incorrectas: nuevasIncorrectas,
      sinResponder,
      tiemposRespuesta: nuevosTiempos,
    };

    const finalizarPorContraReloj = modo === "contraReloj" && !esCorrecta;
    const finalizarPorCantidad =
      modo !== "contraReloj" && numeroPregunta >= Number(cantidadPreguntas);

    continuarLuego(d, finalizarPorContraReloj || finalizarPorCantidad);
  }

  function manejarSinRespuesta() {
    if (procesandoRef.current) return;
    procesandoRef.current = true;

    const nuevoPuntaje = puntaje - 50;
    const nuevoSinResponder = sinResponder + 1;

    setPuntaje(nuevoPuntaje);
    setSinResponder(nuevoSinResponder);

    reproducir(playerTimeout);

    setFeedback({ tipo: "timeout", texto: "Sin respuesta −50" });

    const d = {
      puntaje: nuevoPuntaje,
      correctas,
      incorrectas,
      sinResponder: nuevoSinResponder,
      tiemposRespuesta,
    };

    const debeFinalizar =
      modo === "contraReloj" || numeroPregunta >= Number(cantidadPreguntas);
    continuarLuego(d, debeFinalizar);
  }

  function volverAlMenu() {
    procesandoRef.current = false;
    setPantalla("menu");
    setRespuestaUsuario("");
    setPreguntaActual(null);
    setTiempoRestante(0);
    setFeedback(null);
  }

  function agregarDigito(d) {
    if (procesandoRef.current) return;
    setRespuestaUsuario((v) => {
      if (v.length >= 8) return v;
      if (v === "0") return d;
      return v + d;
    });
  }

  function borrarDigito() {
    if (procesandoRef.current) return;
    setRespuestaUsuario((v) => v.slice(0, -1));
  }

  function limpiarRespuesta() {
    if (procesandoRef.current) return;
    setRespuestaUsuario("");
  }

  const mejorPuntaje =
    historial.length > 0 ? Math.max(...historial.map((i) => i.puntaje)) : 0;

  const progreso =
    modo === "contraReloj"
      ? Math.min(
          100,
          Math.round(
            100 -
              (tiempoRestante /
                dificultades[dificultad].tiempoTotalContraReloj) *
                100
          )
        )
      : Math.min(
          100,
          Math.round(
            (numeroPregunta / Math.max(1, Number(cantidadPreguntas))) * 100
          )
        );

  /* ====================== MENÚ ====================== */
  if (pantalla === "menu") {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <Animated.View style={[styles.flex, { opacity: fadeIn }]}>
          <ScrollView
            contentContainerStyle={styles.menuContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.brandRow}>
              <Text style={styles.brand}>MATHAPP</Text>
              <Text style={styles.brandSub}>cálculo mental</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Dificultad</Text>
              <View style={styles.row}>
                {Object.keys(dificultades).map((key) => (
                  <TouchableOpacity
                    key={key}
                    activeOpacity={0.7}
                    style={[
                      styles.chip,
                      dificultad === key && styles.chipActivo,
                    ]}
                    onPress={() => setDificultad(key)}
                  >
                    <Text
                      style={[
                        styles.chipTexto,
                        dificultad === key && styles.chipTextoActivo,
                      ]}
                    >
                      {dificultades[key].nombre}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Modo</Text>
              {Object.keys(modosJuego).map((key) => (
                <TouchableOpacity
                  key={key}
                  activeOpacity={0.7}
                  style={[
                    styles.modoItem,
                    modo === key && styles.modoItemActivo,
                  ]}
                  onPress={() => setModo(key)}
                >
                  <View
                    style={[
                      styles.radio,
                      modo === key && styles.radioActivo,
                    ]}
                  />
                  <Text
                    style={[
                      styles.modoTexto,
                      modo === key && styles.modoTextoActivo,
                    ]}
                  >
                    {modosJuego[key]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {modo !== "contraReloj" && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Cantidad de preguntas</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={cantidadPreguntas}
                  onChangeText={setCantidadPreguntas}
                  placeholder="10"
                  placeholderTextColor={C.textMuted}
                />
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Audio</Text>
              <View style={styles.row}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[
                    styles.toggle,
                    sonidoActivo && styles.toggleActivo,
                  ]}
                  onPress={() => setSonidoActivo(!sonidoActivo)}
                >
                  <Text
                    style={[
                      styles.toggleTexto,
                      sonidoActivo && styles.toggleTextoActivo,
                    ]}
                  >
                    Sonidos {sonidoActivo ? "on" : "off"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[
                    styles.toggle,
                    musicaActiva && styles.toggleActivo,
                  ]}
                  onPress={() => setMusicaActiva(!musicaActiva)}
                >
                  <Text
                    style={[
                      styles.toggleTexto,
                      musicaActiva && styles.toggleTextoActivo,
                    ]}
                  >
                    Música {musicaActiva ? "on" : "off"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.btnPrimario}
              onPress={iniciarJuego}
            >
              <Text style={styles.btnPrimarioTexto}>Iniciar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.btnTexto}
              onPress={mostrarInstrucciones}
            >
              <Text style={styles.btnTextoTexto}>Ver instrucciones</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <View style={styles.headerHistorial}>
              <Text style={styles.h2}>Historial</Text>
              {historial.length > 0 && (
                <Text style={styles.h2Sub}>Mejor: {mejorPuntaje} pts</Text>
              )}
            </View>

            {historial.length === 0 ? (
              <Text style={styles.vacioTexto}>
                Aún no hay partidas guardadas.
              </Text>
            ) : (
              <>
                {historial.map((item) => (
                  <View key={item.id} style={styles.histItem}>
                    <View style={styles.histHeader}>
                      <Text style={styles.histPuntaje}>{item.puntaje}</Text>
                      <Text style={styles.histModo}>
                        {item.modo} · {item.dificultad}
                      </Text>
                    </View>
                    <Text style={styles.histDetalle}>
                      Correctas {item.correctas} · Incorrectas{" "}
                      {item.incorrectas} · Sin responder {item.sinResponder}
                    </Text>
                    <Text style={styles.histDetalle}>
                      Precisión {item.precision}% · Promedio{" "}
                      {item.tiempoPromedio}s
                    </Text>
                    <Text style={styles.histFecha}>{item.fecha}</Text>
                  </View>
                ))}

                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.btnPeligro}
                  onPress={borrarHistorial}
                >
                  <Text style={styles.btnPeligroTexto}>Borrar historial</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    );
  }

  /* ====================== JUEGO ====================== */
  if (pantalla === "juego") {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <Animated.View style={[styles.flex, { opacity: fadeIn }]}>
          <ScrollView
            contentContainerStyle={styles.gameContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.gameHeader}>
              <View>
                <Text style={styles.gameLabel}>
                  {modo === "contraReloj"
                    ? `Pregunta ${numeroPregunta}`
                    : `Pregunta ${numeroPregunta} de ${cantidadPreguntas}`}
                </Text>
                <Text style={styles.gameLabelSub}>{modosJuego[modo]}</Text>
              </View>
              <View style={styles.scoreBox}>
                <Text style={styles.scoreNum}>{puntaje}</Text>
                <Text style={styles.scoreLabel}>pts</Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${progreso}%` }]}
              />
            </View>

            <View
              style={[
                styles.timerCard,
                tiempoRestante <= 5 && styles.timerCardAlerta,
              ]}
            >
              <Text
                style={[
                  styles.timerTexto,
                  tiempoRestante <= 5 && styles.timerTextoAlerta,
                ]}
              >
                {modo === "contraReloj"
                  ? `${tiempoRestante}s totales`
                  : `${tiempoRestante}s`}
              </Text>
            </View>

            <View
              style={[
                styles.operacionCard,
                feedback?.tipo === "correcto" && styles.opCorrecta,
                feedback?.tipo === "incorrecto" && styles.opIncorrecta,
                feedback?.tipo === "timeout" && styles.opTimeout,
              ]}
            >
              <Text style={styles.operacionTexto}>{preguntaActual.texto}</Text>
            </View>

            {feedback && (
              <Text
                style={[
                  styles.feedbackTexto,
                  feedback.tipo === "correcto" && styles.feedbackCorrecto,
                  feedback.tipo === "incorrecto" && styles.feedbackIncorrecto,
                  feedback.tipo === "timeout" && styles.feedbackTimeout,
                ]}
              >
                {feedback.texto}
              </Text>
            )}

            {(modo === "clasico" || modo === "contraReloj") && (
              <View>
                <View style={styles.display}>
                  <Text
                    style={[
                      styles.displayTexto,
                      !respuestaUsuario && styles.displayPlaceholder,
                    ]}
                  >
                    {respuestaUsuario || "Resultado"}
                  </Text>
                </View>

                <View style={styles.teclado}>
                  {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((n) => (
                    <TouchableOpacity
                      key={n}
                      activeOpacity={0.7}
                      style={styles.tecla}
                      onPress={() => agregarDigito(n)}
                    >
                      <Text style={styles.teclaTexto}>{n}</Text>
                    </TouchableOpacity>
                  ))}

                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.teclaSec}
                    onPress={borrarDigito}
                    onLongPress={limpiarRespuesta}
                  >
                    <Text style={styles.teclaSecTexto}>⌫</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.tecla}
                    onPress={() => agregarDigito("0")}
                  >
                    <Text style={styles.teclaTexto}>0</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.teclaOk}
                    onPress={() => responder()}
                  >
                    <Text style={styles.teclaOkTexto}>OK</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {modo === "verdaderoFalso" && (
              <View style={styles.vfRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.vfBtn, styles.vfBtnTrue]}
                  onPress={() => responder(true)}
                >
                  <Text style={styles.vfTexto}>Verdadero</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.vfBtn, styles.vfBtnFalse]}
                  onPress={() => responder(false)}
                >
                  <Text style={styles.vfTexto}>Falso</Text>
                </TouchableOpacity>
              </View>
            )}

            {modo === "multipleChoice" && (
              <View style={styles.mcCol}>
                {preguntaActual.opciones.map((op) => (
                  <TouchableOpacity
                    key={op}
                    activeOpacity={0.85}
                    style={styles.mcBtn}
                    onPress={() => responder(op)}
                  >
                    <Text style={styles.mcTexto}>{op}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.btnTexto}
              onPress={volverAlMenu}
            >
              <Text style={styles.btnTextoTexto}>Volver al menú</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    );
  }

  /* ====================== RESULTADO ====================== */
  if (pantalla === "resultado" && resultadoActual) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <Animated.View style={[styles.flex, { opacity: fadeIn }]}>
          <ScrollView
            contentContainerStyle={styles.resultContainer}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.resultTitulo}>Resultado</Text>
            <Text style={styles.resultModo}>
              {resultadoActual.modo} · {resultadoActual.dificultad}
            </Text>

            <View style={styles.resultPuntajeBox}>
              <Text style={styles.resultPuntaje}>{resultadoActual.puntaje}</Text>
              <Text style={styles.resultPuntajeLabel}>puntos</Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statValor}>{resultadoActual.correctas}</Text>
                <Text style={styles.statLabel}>Correctas</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValor}>
                  {resultadoActual.incorrectas}
                </Text>
                <Text style={styles.statLabel}>Incorrectas</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValor}>
                  {resultadoActual.sinResponder}
                </Text>
                <Text style={styles.statLabel}>Sin responder</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValor}>{resultadoActual.precision}%</Text>
                <Text style={styles.statLabel}>Precisión</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValor}>
                  {resultadoActual.tiempoPromedio}s
                </Text>
                <Text style={styles.statLabel}>Tiempo promedio</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValor}>
                  {resultadoActual.operaciones}
                </Text>
                <Text style={styles.statLabel}>Operaciones</Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.btnPrimario}
              onPress={iniciarJuego}
            >
              <Text style={styles.btnPrimarioTexto}>Jugar de nuevo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.btnSecundario}
              onPress={volverAlMenu}
            >
              <Text style={styles.btnSecundarioTexto}>Volver al menú</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return null;
}

/* ============================================================
   PALETA MINIMALISTA
   Paleta papel-pizarra: blanco roto + slate oscuro como único
   acento. Tonos desaturados, sin gradientes ni glows.
   ============================================================ */
const C = {
  bg: "#F4F1EB",          // beige muy claro, tipo papel
  surface: "#FFFFFF",
  surfaceAlt: "#F8F6F1",
  border: "#E2DDD2",
  borderStrong: "#CFC9BB",

  text: "#1F1F1F",
  textSecondary: "#5A5A5A",
  textMuted: "#9A9388",

  accent: "#2E3B45",      // slate oscuro - único acento
  accentSoft: "#E6E4DC",  // fondo cuando algo está seleccionado

  success: "#5C7A5C",     // verde sage muy desaturado
  successSoft: "#E8EEE6",
  error: "#94524A",       // rojo terracota suave
  errorSoft: "#F1E3E0",
  warning: "#A8884A",
  warningSoft: "#F0E8D6",
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },

  menuContainer: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 40,
  },
  gameContainer: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 36,
  },
  resultContainer: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 36,
    justifyContent: "center",
  },

  /* Branding */
  brandRow: {
    marginBottom: 28,
  },
  brand: {
    fontSize: 30,
    fontWeight: "700",
    color: C.text,
    letterSpacing: 4,
  },
  brandSub: {
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 2,
    letterSpacing: 1,
  },

  /* Secciones */
  section: { marginBottom: 22 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textSecondary,
    marginBottom: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  row: { flexDirection: "row", gap: 8 },

  /* Chips de dificultad */
  chip: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActivo: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  chipTexto: {
    fontSize: 14,
    fontWeight: "600",
    color: C.text,
  },
  chipTextoActivo: { color: "#FFFFFF" },

  /* Modos (lista tipo radio) */
  modoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: C.surface,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  modoItemActivo: {
    backgroundColor: C.accentSoft,
    borderColor: C.borderStrong,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    marginRight: 12,
  },
  radioActivo: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  modoTexto: {
    fontSize: 15,
    color: C.text,
    fontWeight: "500",
  },
  modoTextoActivo: { fontWeight: "600" },

  /* Input */
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: 17,
    color: C.text,
    textAlign: "center",
  },

  /* Toggles audio */
  toggle: {
    flex: 1,
    backgroundColor: C.surface,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  toggleActivo: {
    backgroundColor: C.accentSoft,
    borderColor: C.borderStrong,
  },
  toggleTexto: {
    fontSize: 13,
    color: C.textSecondary,
    fontWeight: "500",
  },
  toggleTextoActivo: { color: C.text, fontWeight: "600" },

  /* Botones */
  btnPrimario: {
    backgroundColor: C.accent,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 6,
  },
  btnPrimarioTexto: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  btnSecundario: {
    backgroundColor: "transparent",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 1,
    borderColor: C.borderStrong,
  },
  btnSecundarioTexto: {
    color: C.text,
    fontSize: 15,
    fontWeight: "600",
  },
  btnTexto: {
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 6,
  },
  btnTextoTexto: {
    color: C.textSecondary,
    fontSize: 14,
    fontWeight: "500",
  },
  btnPeligro: {
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  btnPeligroTexto: {
    color: C.error,
    fontSize: 13,
    fontWeight: "600",
  },

  /* Separador */
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 24,
  },

  /* Historial */
  headerHistorial: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  h2: {
    fontSize: 18,
    fontWeight: "700",
    color: C.text,
  },
  h2Sub: {
    fontSize: 13,
    color: C.textSecondary,
    fontWeight: "500",
  },
  vacioTexto: {
    color: C.textMuted,
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 16,
  },
  histItem: {
    backgroundColor: C.surface,
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  histHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 4,
  },
  histPuntaje: {
    fontSize: 20,
    fontWeight: "700",
    color: C.text,
    marginRight: 10,
  },
  histModo: {
    fontSize: 13,
    color: C.textSecondary,
    fontWeight: "500",
  },
  histDetalle: {
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 2,
  },
  histFecha: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 6,
  },

  /* Juego — header */
  gameHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  gameLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: C.text,
  },
  gameLabelSub: {
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 2,
  },
  scoreBox: {
    backgroundColor: C.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    minWidth: 78,
  },
  scoreNum: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "700",
  },
  scoreLabel: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
    opacity: 0.75,
  },

  /* Progreso */
  progressTrack: {
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 14,
  },
  progressFill: {
    height: "100%",
    backgroundColor: C.accent,
  },

  /* Timer */
  timerCard: {
    backgroundColor: C.surface,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  timerCardAlerta: {
    backgroundColor: C.errorSoft,
    borderColor: C.error,
  },
  timerTexto: {
    fontSize: 17,
    fontWeight: "600",
    color: C.text,
  },
  timerTextoAlerta: { color: C.error, fontWeight: "700" },

  /* Operación */
  operacionCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingVertical: 32,
    paddingHorizontal: 16,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
  },
  opCorrecta: {
    borderColor: C.success,
    backgroundColor: C.successSoft,
  },
  opIncorrecta: {
    borderColor: C.error,
    backgroundColor: C.errorSoft,
  },
  opTimeout: {
    borderColor: C.warning,
    backgroundColor: C.warningSoft,
  },
  operacionTexto: {
    fontSize: 38,
    fontWeight: "500",
    color: C.text,
    letterSpacing: 1,
  },

  feedbackTexto: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 6,
    marginBottom: 10,
  },
  feedbackCorrecto: { color: C.success },
  feedbackIncorrecto: { color: C.error },
  feedbackTimeout: { color: C.warning },

  /* Display de respuesta */
  display: {
    backgroundColor: C.surface,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 10,
    alignItems: "center",
    minHeight: 56,
    justifyContent: "center",
  },
  displayTexto: {
    fontSize: 26,
    fontWeight: "600",
    color: C.text,
  },
  displayPlaceholder: {
    color: C.textMuted,
    fontSize: 15,
    fontWeight: "500",
  },

  /* Teclado numérico */
  teclado: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tecla: {
    width: "31.5%",
    backgroundColor: C.surface,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  teclaTexto: {
    fontSize: 22,
    fontWeight: "500",
    color: C.text,
  },
  teclaSec: {
    width: "31.5%",
    backgroundColor: C.surfaceAlt,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  teclaSecTexto: {
    fontSize: 20,
    color: C.textSecondary,
    fontWeight: "500",
  },
  teclaOk: {
    width: "31.5%",
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  teclaOkTexto: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 1,
  },

  /* Verdadero / Falso */
  vfRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  vfBtn: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  vfBtnTrue: {
    backgroundColor: C.surface,
    borderColor: C.borderStrong,
  },
  vfBtnFalse: {
    backgroundColor: C.surface,
    borderColor: C.borderStrong,
  },
  vfTexto: {
    fontSize: 16,
    fontWeight: "600",
    color: C.text,
  },

  /* Multiple choice */
  mcCol: { gap: 10, marginTop: 4 },
  mcBtn: {
    backgroundColor: C.surface,
    paddingVertical: 18,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  mcTexto: {
    fontSize: 22,
    fontWeight: "600",
    color: C.text,
  },

  /* Resultado */
  resultTitulo: {
    fontSize: 26,
    fontWeight: "700",
    color: C.text,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  resultModo: {
    fontSize: 13,
    color: C.textSecondary,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 18,
  },
  resultPuntajeBox: {
    alignItems: "center",
    marginBottom: 24,
  },
  resultPuntaje: {
    fontSize: 56,
    fontWeight: "700",
    color: C.text,
  },
  resultPuntajeLabel: {
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 2,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 22,
  },
  statBox: {
    width: "31.5%",
    backgroundColor: C.surface,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  statValor: {
    fontSize: 19,
    fontWeight: "700",
    color: C.text,
  },
  statLabel: {
    fontSize: 11,
    color: C.textSecondary,
    marginTop: 4,
    textAlign: "center",
    fontWeight: "500",
  },
});
