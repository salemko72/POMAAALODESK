import { useState } from 'react'
import { fireEvent,render,screen } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
vi.mock('./lib/operations',async original=>({...await original<typeof import('./lib/operations')>(),listGuests:vi.fn().mockResolvedValue([{id:'g',name:'Martin',email:'martin@example.invalid',phone:'123',country:'Germany',language:'German',notes:'Cot'}])}))
import { StayExtras } from './components/StayExtras'
import { emptyExtras } from './lib/stay-extra-values'
it('suggests contacts, fills details and calculates a nightly total',async()=>{
 const name=vi.fn()
 function Harness(){const [value,setValue]=useState(emptyExtras);return <StayExtras value={value} onChange={setValue} start="2026-09-10" end="2026-09-13" onGuestName={name}/>}
 render(<Harness/>)
 fireEvent.change(screen.getByLabelText('Guest'),{target:{value:'Martin'}})
 fireEvent.click(await screen.findByRole('button',{name:/Martin/}))
 expect(name).toHaveBeenCalledWith('Martin')
 expect(screen.getByLabelText(/email/i)).toHaveValue('martin@example.invalid')
 fireEvent.change(screen.getByLabelText(/nightly rate/i),{target:{value:'99.99'}})
 expect(screen.getByText('3 nights · Total: 299.97')).toBeInTheDocument()
})
