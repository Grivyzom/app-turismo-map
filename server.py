import asyncio
import websockets
import torch
import tempfile
import os
import json
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline

# 1. INICIALIZACIÓN DEL MODELO
# Si no tienes GPU NVIDIA, el modelo 'large' es demasiado pesado para CPU y latencia internacional.
# 'whisper-tiny' es ~50 veces más rápido que 'large' en CPU.
device = "cuda:0" if torch.cuda.is_available() else "cpu"
torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
model_id = "openai/whisper-tiny" 

print(f"Cargando modelo {model_id} en {device}... (Optimizado para baja latencia)")

model = AutoModelForSpeechSeq2Seq.from_pretrained(
    model_id, 
    torch_dtype=torch_dtype, 
    low_cpu_mem_usage=True, 
    use_safetensors=True
)
model.to(device)

processor = AutoProcessor.from_pretrained(model_id)

# Creamos el pipeline de transcripción optimizado
pipe = pipeline(
    "automatic-speech-recognition",
    model=model,
    tokenizer=processor.tokenizer,
    feature_extractor=processor.feature_extractor,
    torch_dtype=torch_dtype,
    device=device,
    chunk_length_s=15,
    batch_size=1,
)

# Optimizaciones agresivas para velocidad (Greedy Decoding)
generate_kwargs = {
    "language": "spanish",
    "task": "transcribe",
    "max_new_tokens": 64,
    "num_beams": 1, 
    "condition_on_prev_tokens": False
}

print(f"Servidor listo. Esperando conexiones en puerto 8765...")

# Lógica de estabilización de texto
def estabilizar_texto(texto_previo, nuevo_texto):
    if not texto_previo:
        return nuevo_texto
    if nuevo_texto.lower().startswith(texto_previo.lower()):
        return nuevo_texto
    # Si Whisper cambia una palabra corta por algo más largo pero que incluye la anterior,
    # o si hay mucha discrepancia, priorizamos la longitud y coherencia.
    if len(nuevo_texto) < len(texto_previo) * 0.7:
        return texto_previo
    return nuevo_texto

# 2. SERVIDOR WEBSOCKET
async def procesar_audio(websocket):
    print(f"Nuevo usuario conectado desde {websocket.remote_address}")
    audio_buffer = b""
    texto_establecido = ""
    
    try:
        async for mensaje in websocket:
            if isinstance(mensaje, str):
                if mensaje == "ping":
                    await websocket.send("pong")
                continue

            audio_buffer += mensaje
            
            # Bajamos el umbral significativamente. El audio comprimido ocupa poco espacio.
            if len(audio_buffer) < 2000: 
                continue

            with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp_file:
                tmp_file.write(audio_buffer)
                tmp_filepath = tmp_file.name

            try:
                # Transcribimos
                result = pipe(tmp_filepath, generate_kwargs=generate_kwargs)
                texto_transcrito = result["text"].strip()
                
                if texto_transcrito:
                    # Simplificamos la estabilización para que sea más reactiva
                    if len(texto_transcrito) > len(texto_establecido) * 0.5:
                        texto_establecido = texto_transcrito

                    await websocket.send(json.dumps({
                        "text": texto_establecido,
                        "is_final": False
                    }))
                    print(f"Enviado ({len(audio_buffer)}b): {texto_establecido}")
                
            except Exception as e:
                print(f"Error en pipe: {e}")
            finally:
                if os.path.exists(tmp_filepath):
                    os.remove(tmp_filepath)

    except websockets.exceptions.ConnectionClosed as e:
        print(f"Socket cerrado: {e}")
    except Exception as e:
        print(f"Error socket: {e}")

async def main():
    async with websockets.serve(procesar_audio, "0.0.0.0", 8765):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
