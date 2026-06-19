import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/authRoutes.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)

app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working!' })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})