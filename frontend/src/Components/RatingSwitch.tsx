import styles from './RatingSwitch.module.scss';
import React, {ForwardedRef, useEffect, useRef, useState} from 'react';
import {useAPI} from '../AppState/AppState';
import { toast } from 'react-toastify';
import {pluralize} from '../Utils/utils';
import Username from './Username';


type RatingSwitchProps = {
    rating: {
        vote?: number;
        value: number;
    };
    type: 'post' | 'comment' | 'user';
    id: number;
    double?: boolean;
    onVote?: (value: number, vote?: number, postApiCall?: boolean) => void;
    votingDisabled?: boolean;
};

type VoteType = { vote: number, username: string };

export default function RatingSwitch(props: RatingSwitchProps) {
    const api = useAPI();
    const [currentVote, setCurrentVote] = React.useState<number | undefined>(props.rating.vote);
    const [currentRating, setCurrentRating] = React.useState<number>(props.rating.value);
    const [showPopup, setShowPopup] = useState(false);
    const ratingRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const [votes, setVotes] = useState<VoteType[]>();

    useEffect(() => {
        setCurrentVote(props.rating.vote);
        setCurrentRating(props.rating.value);
    }, [props]);

    useEffect(() => {
        if(!votes) {
            return;
        }
        const rating = (votes || []).reduce((acc, item) => acc + item.vote, 0);
        setCurrentRating(rating);
    }, [votes]);

    useEffect(() => {
        if (!ratingRef.current || !popupRef.current) {
            return;
        }
        if (!showPopup) {
            return;
        }

        if (!votes) {
            api.voteAPI.list(props.type, props.id)
                .then(result => {
                    setVotes(result.votes);
                })
                .catch(() => {
                    toast.error('Не удалось загрузить голоса!');
                    setShowPopup(false);
                });
        }

        const [popupEl, ratingEl] = [popupRef.current, ratingRef.current];

        const rect = ratingEl.getBoundingClientRect();
        const y = rect.y + document.documentElement.scrollTop || 0;
        const rh = ratingEl.clientHeight;
        const ph = popupEl.clientHeight;

        const isTotalHeightMoreThanPageHeight  = y + rh + ph > document.documentElement.scrollHeight;
        if(isTotalHeightMoreThanPageHeight){
            popupEl.style.bottom = '30px';
        } else {
            popupEl.style.top = '30px';
        }

        const clickHandler = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            hide();
            return false;
        };
        document.addEventListener('mousedown', clickHandler);
        return () => {
            document.removeEventListener('mousedown', clickHandler);
        };

    }, [showPopup, ratingRef, popupRef, votes, currentVote, props.id, props.type, api.voteAPI]);

    const hide = () => {
        setShowPopup(false);
        setVotes(undefined);
    };

    const handleVote = (vote: number) => {
        return async (ev: React.MouseEvent) => {
            ev.stopPropagation();
            ev.preventDefault();
            // unfocus a button to space button will keep scrolling the page
            (document.activeElement as HTMLButtonElement).blur();
            const prevVote = currentVote;
            const prevRating = currentRating;
            if (currentVote === vote) {
                vote = 0;
            }

            const newRating = currentRating - (currentVote || 0) + vote;
            setCurrentVote(vote);
            setCurrentRating(newRating);
            if (props.onVote) {
               props.onVote(newRating, vote, false);
            }

            try {
                const result = await api.voteAPI.vote(props.type, props.id, vote);
                setCurrentVote(result.vote);
                setCurrentRating(result.rating);

                if (props.onVote) {
                    props.onVote(result.rating, result.vote, true);
                }
            } catch (exc) {
                setCurrentVote(prevVote);
                setCurrentRating(prevRating);
                toast.warn('Голос не учтён 🤬', { position: 'bottom-right' });
            }
        };
    };

    const handleVoteList = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShowPopup(!showPopup);
    };

    const valueStyles = [styles.value];
    const plusStyles = ['i', 'i-rating_plus'];
    const minusStyles = ['i', 'i-rating_minus'];
    const plus2Styles = ['i', 'i-rating_plus'];
    const minus2Styles = ['i', 'i-rating_minus'];
    if (currentVote && currentVote < 0) {
        valueStyles.push(styles.minus);
        minusStyles.push(styles.minus);
        plusStyles.push(styles.dis);
        plus2Styles.push(styles.dis);
        if (currentVote < -1) {
            minus2Styles.push(styles.minus);
        }
    }
    else if (currentVote && currentVote > 0) {
        valueStyles.push(styles.plus);
        plusStyles.push(styles.plus);
        minusStyles.push(styles.dis);
        minus2Styles.push(styles.dis);
        if (currentVote > 1) {
            plus2Styles.push(styles.plus);
        }
    }

    const buttonExtraProps = {
        title: props.votingDisabled ? 'Голосование за карму невозможно. Загляните во вкладку "Саморегуляция" в профиле.' : undefined,
        disabled: props.votingDisabled
    };

    return (
        <div className={styles.ratingWrapper}>
            <div ref={ratingRef} className={styles.rating}>
                {props.double && <button {...buttonExtraProps} className={minus2Styles.join(' ')} onClick={handleVote(-2)}></button>}
                <button {...buttonExtraProps} className={minusStyles.join(' ')} onClick={handleVote(-1)}></button>
                <div onClick={handleVoteList} className={valueStyles.join(' ')}>{currentRating}</div>
                <button {...buttonExtraProps} className={plusStyles.join(' ')} onClick={handleVote(1)}></button>
                {props.double && <button {...buttonExtraProps} className={plus2Styles.join(' ')} onClick={handleVote(2)}></button>}
            </div>
            {showPopup && <RatingList ref={popupRef} vote={currentVote || 0} rating={currentRating} votes={votes} hidePopup={hide}></RatingList>}
        </div>
    );
}

type RatingListProps = {
    rating: number;
    vote: number;
    votes?: VoteType[];
    hidePopup: () => void
};

const RatingList = React.forwardRef((props: RatingListProps, ref: ForwardedRef<HTMLDivElement>) => {
    const [voteList, setVoteList] = useState<{votes: VoteType[][], counters: {users: number, value: number}[]} | undefined>();

    useEffect(() => {
        if (!props.votes) {
            return;
        }

        const votes: VoteType[][] = [[], []];
        const counters: {users: number, value: number}[] = [{users: 0, value: 0}, {users: 0, value: 0}];

        for (const vote of props.votes) {
            if (vote.vote === 0) {
                continue;
            }
            const cnt = vote.vote > 0 ? 1 : 0;
            votes[cnt].push(vote);
            counters[cnt].users++;
            counters[cnt].value += vote.vote;
        }

        setVoteList({votes, counters});
    }, [props.rating, props.votes, props.vote]);

    const listStyles = [styles.listValue];
    if (props.vote > 0) {
        listStyles.push(styles.listValuePlus);
    }
    else if (props.vote < 0) {
        listStyles.push(styles.listValueMinus);
    }

    const popupMouseDownHandler = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
    };

    function renderVotes(votes: VoteType[]) {
        if(votes.length === 0) {
            return <span className={styles.listEmpty}>Пусто. Совсем ничего.</span>;
        }

        return votes.map((v) => {
            return (
                <div key={v.username} onClick={props.hidePopup}>
                    <Username className={styles.username} user={ {username: v.username} } />
                    {v.vote > 0 ? `+${v.vote}`: v.vote}
                </div>
            );
        });
    }

    return (
        <div ref={ref} className={styles.list} onMouseDown={popupMouseDownHandler}>
            <div className={styles.listUp}>
                <div className={listStyles.join(' ')}>{props.rating}</div>
                <div className={styles.listDetails}>
                    {voteList ? <>
                        <div>{voteList.counters[1].users > 0 ? pluralize(voteList.counters[1].value, ['плюс', 'плюса', 'плюсов']) + ' от ' + pluralize(voteList.counters[1].users, ['юзера', 'юзеров', 'юзеров']) : 'нет плюсов'}</div>
                        <div>{voteList.counters[0].users > 0 ? pluralize(voteList.counters[0].value, ['минус', 'минуса', 'минусов']) + ' от ' + pluralize(voteList.counters[0].users, ['юзера', 'юзеров', 'юзеров']) : 'нет минусов'}</div>
                    </> : <div>...</div>}
                </div>
            </div>
            <div className={styles.listDown}>
                <div className={styles.listScrollContainer}>
                    {voteList ? <>
                        <div className={styles.listMinus}>
                            {renderVotes(voteList.votes[0])}
                        </div>
                        <div className={styles.listPlus}>
                            {renderVotes(voteList.votes[1])}
                        </div>
                    </>
                    : <>...</>}
                </div>
            </div>
        </div>
    );
});
