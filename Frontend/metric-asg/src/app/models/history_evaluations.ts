export interface AmbitHistory{
    ambit_name: string,
    ambit_color: string,
    ambit_id: number,
    score: number,
    date?: string,
    letter?: string
}

export interface History{
    evaluation_id: number,
    date: string,
    global_score: number,
    ambits: AmbitHistory []
}

export interface Averages{
    global_score: number,
    ambits: AmbitHistory []
}

export interface EvaluationHistory{
    history: History [],
    averages: Averages
}