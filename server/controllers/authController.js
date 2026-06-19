export const registerUser = (req, res) => {
  console.log('Register request received:', req.body)
  res.json({ message: 'Register endpoint working', data: req.body })
}

export const loginUser = (req, res) => {
  console.log('Login request received:', req.body)
  res.json({ message: 'Login endpoint working', data: req.body })
}