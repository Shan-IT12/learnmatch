import pool from '../config/db.js'
import { loginStaff } from '../services/staffAccountService.js'
import { workflowHandler } from '../services/workflowSupport.js'

export const loginAdmin = workflowHandler((req) => loginStaff(pool, 'admin', req.body))
