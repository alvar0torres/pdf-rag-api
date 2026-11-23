import styles from '../DocumentsPage.module.css'

type Props = { number: string; title: string; caption: string; id: string }

function SectionHeading({ number, title, caption, id }: Props) {
  return (
    <div className={styles['section-heading']}>
      <div><span className={styles['section-number']}>{number}</span><h2 id={id}>{title}</h2></div>
      <span className={styles['section-caption']}>{caption}</span>
    </div>
  )
}

export default SectionHeading
