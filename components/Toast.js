export default function Toast({ msg }) {
  return (
    <div style={{
      position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
      background: '#1a3a5c', color: '#fff', padding: '10px 24px',
      borderRadius: 20, fontWeight: 700, fontSize: '0.9rem',
      zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', whiteSpace: 'nowrap',
    }}>
      {msg}
    </div>
  )
}
